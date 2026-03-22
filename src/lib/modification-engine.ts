import {
    Block,
    DESIGN_STYLES,
    HtmlPatch,
    ModificationEngineRequest,
    ModificationEngineResponse,
    ModificationExecutorMode,
    ModificationRequestKind,
} from '@/types';
import {
    buildAddSectionPrompt,
    buildEditPrompt,
    buildElementEditPrompt,
    buildGlobalStyleEditPrompt,
    buildPatchEditPrompt,
    getElementEditSystemPrompt,
    getSystemPrompt,
    parseJsonObjectResponse,
    parseResponse,
} from '@/lib/prompt';
import {
    createBlock,
    ensureUniqueBlockIdentity,
    extractBlockIdFromHtml,
    setRootSectionIdentifiers,
} from '@/lib/blocks';
import { applyPatch } from '@/lib/patch';
import { textFromOpenRouter } from '@/lib/openrouter';
import { applyModificationOperationsToBlocks } from '@/lib/modification';
import { logger } from '@/lib/logger';

type EngineRuntime = {
    apiKey: string;
    model?: string;
};

type InternalModificationRequest = ModificationEngineRequest & {
    selectedElementHtml?: string;
};

function assertRequestKind(value: string): value is ModificationRequestKind {
    return [
        'section-edit',
        'element-edit',
        'multi-section-edit',
        'add-section',
        'remove-section',
        'global-style-edit',
    ].includes(value);
}

function getBlockById(blocks: Block[], blockId?: string | null): Block | null {
    if (!blockId) return null;
    return blocks.find((block) => block.id === blockId) || null;
}

function looksLikeSingleSection(html: string): boolean {
    return /^\s*<section\b[\s\S]*<\/section>\s*$/i.test(html.trim());
}

function extractRootSectionId(html: string): string | null {
    const match = html.match(/<section\b[^>]*\bid="([^"]+)"/i);
    return match ? match[1] : null;
}

function collectRootSectionIds(blocks: Block[]): string[] {
    return blocks
        .map((block) => extractRootSectionId(block.html) || block.id)
        .filter(Boolean);
}

function containsDisallowedMarkup(html: string): boolean {
    if (/<(?:iframe|object|embed|frameset|frame)\b/i.test(html)) {
        return true;
    }

    const scripts = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi));
    return scripts.some((match) => {
        const content = (match[1] || '').trim();
        const normalized = content.replace(/\s+/g, ' ');
        const allowsMobileMenuToggle =
            normalized.includes('mobile-menu') &&
            (normalized.includes("classList.toggle('hidden')") ||
                normalized.includes('classList.toggle("hidden")'));

        return !allowsMobileMenuToggle;
    });
}

function reviewUpdatedBlockHtml(html: string, blockId: string): string {
    const normalizedHtml = setRootSectionIdentifiers(html.trim(), blockId);

    if (!looksLikeSingleSection(normalizedHtml)) {
        throw new Error(`Updated block "${blockId}" must be a single <section> root.`);
    }

    if (containsDisallowedMarkup(normalizedHtml)) {
        throw new Error(`Updated block "${blockId}" contains disallowed markup.`);
    }

    return normalizedHtml;
}

function reviewInsertedBlock(block: Block, existingBlocks: Block[]): Block {
    const normalized = ensureUniqueBlockIdentity(block, existingBlocks.map((entry) => entry.id));
    const reviewedHtml = reviewUpdatedBlockHtml(normalized.html, normalized.id);
    return {
        ...normalized,
        html: reviewedHtml,
        visible: normalized.visible !== false,
    };
}

function assertUniqueRootIds(blocks: Block[]): void {
    const ids = collectRootSectionIds(blocks);
    const seen = new Set<string>();
    for (const id of ids) {
        if (seen.has(id)) {
            throw new Error(`Duplicate root section id detected after modification: "${id}".`);
        }
        seen.add(id);
    }
}

function buildExistingSectionsSummary(blocks: Block[]): string {
    return blocks
        .map((block, index) => {
            const rootId = extractRootSectionId(block.html) || block.id;
            return `${index + 1}. ${block.label} (id="${rootId}")`;
        })
        .join('\n');
}

function chooseSectionEditExecutorMode(prompt: string): ModificationExecutorMode {
    if (/\b(layout|restructure|redesign|overhaul|rebuild|rearrange|convert|turn into|make it look completely|full width|two column|three column|grid|hero layout)\b/i.test(prompt)) {
        return 'full-html';
    }

    return 'patch';
}

function inferStyleIdFromPrompt(prompt: string): string | undefined {
    const normalized = prompt.toLowerCase();
    if (/\bbold\s*(?:&|and)\s*dark\b/.test(normalized)) return 'bold';
    if (/\bprofessional\b/.test(normalized)) return 'professional';
    if (/\bplayful\b/.test(normalized)) return 'playful';
    if (/\bminimal(?:ist)?\b/.test(normalized)) return 'minimal';
    if (/\belegant\b/.test(normalized)) return 'elegant';
    return undefined;
}

async function requestModelText(params: {
    apiKey: string;
    model?: string;
    systemPrompt: string;
    userPrompt: string;
}): Promise<string> {
    return textFromOpenRouter({
        apiKey: params.apiKey,
        model: params.model,
        systemPrompt: params.systemPrompt,
        prompt: params.userPrompt,
    });
}

async function executePatchEdit(params: {
    prompt: string;
    block: Block;
    runtime: EngineRuntime;
}): Promise<{ html: string; summary: string }> {
    const patchContent = await requestModelText({
        apiKey: params.runtime.apiKey,
        model: params.runtime.model,
        systemPrompt: 'You generate precise JSON patches for a landing page section. Return only JSON with valid patch operations.',
        userPrompt: buildPatchEditPrompt(params.block.html, params.prompt),
    });
    const patch = parseJsonObjectResponse<HtmlPatch>(patchContent);

    if (!patch?.ops?.length) {
        throw new Error('Patch edit did not return valid operations.');
    }

    const html = applyPatch(params.block.html, patch);
    return {
        html,
        summary: `Applied a targeted update to ${params.block.label}.`,
    };
}

async function executeFullBlockEdit(params: {
    prompt: string;
    block: Block;
    runtime: EngineRuntime;
    designStylePrompt?: string;
    projectContext?: string;
    globalStyle?: boolean;
}): Promise<{ html: string; summary: string }> {
    const systemPrompt = getSystemPrompt(params.designStylePrompt, params.projectContext);
    const userPrompt = params.globalStyle
        ? buildGlobalStyleEditPrompt(params.block.html, params.prompt, params.block.id)
        : buildEditPrompt(params.block.html, params.prompt, params.block.id);
    const responseText = await requestModelText({
        apiKey: params.runtime.apiKey,
        model: params.runtime.model,
        systemPrompt,
        userPrompt,
    });
    const result = parseResponse(responseText);
    return {
        html: result.html,
        summary: result.summary || `Updated ${params.block.label}.`,
    };
}

async function executeElementEdit(params: {
    prompt: string;
    block: Block;
    selectedElementHtml: string;
    runtime: EngineRuntime;
    designStylePrompt?: string;
    projectContext?: string;
}): Promise<{ html: string; summary: string }> {
    const responseText = await requestModelText({
        apiKey: params.runtime.apiKey,
        model: params.runtime.model,
        systemPrompt: getElementEditSystemPrompt(params.designStylePrompt, params.projectContext),
        userPrompt: buildElementEditPrompt(params.selectedElementHtml, params.prompt, params.block.id),
    });
    const updatedElementHtml = responseText.trim();

    if (!updatedElementHtml) {
        throw new Error('Element edit returned empty HTML.');
    }

    if (params.selectedElementHtml === params.block.html) {
        return {
            html: updatedElementHtml,
            summary: `Updated ${params.block.label}.`,
        };
    }

    if (!params.block.html.includes(params.selectedElementHtml)) {
        throw new Error('Selected element could not be matched inside the target block.');
    }

    const html = params.block.html.replace(params.selectedElementHtml, updatedElementHtml);
    return {
        html,
        summary: `Updated a targeted element in ${params.block.label}.`,
    };
}

async function executeAddSection(params: {
    prompt: string;
    blocks: Block[];
    runtime: EngineRuntime;
    designStylePrompt?: string;
    projectContext?: string;
}): Promise<{ block: Block; summary: string }> {
    const responseText = await requestModelText({
        apiKey: params.runtime.apiKey,
        model: params.runtime.model,
        systemPrompt: getSystemPrompt(params.designStylePrompt, params.projectContext),
        userPrompt: buildAddSectionPrompt(params.prompt, buildExistingSectionsSummary(params.blocks)),
    });
    const result = parseResponse(responseText);
    const block = reviewInsertedBlock(createBlock(result.html), params.blocks);
    return {
        block,
        summary: result.summary || `Added ${block.label}.`,
    };
}

function validateModificationRequest(request: InternalModificationRequest): void {
    if (!request.prompt?.trim()) {
        throw new Error('Prompt is required.');
    }

    if (!Array.isArray(request.blocks)) {
        throw new Error('Blocks are required.');
    }

    if (!assertRequestKind(request.requestKind)) {
        throw new Error('Unsupported modification request kind.');
    }

    if (request.requestKind === 'section-edit' && !request.selectedBlockId) {
        throw new Error('selectedBlockId is required for section edits.');
    }

    if (request.requestKind === 'element-edit' && (!request.selectedBlockId || !request.selectedElementSelector)) {
        throw new Error('selectedBlockId and selectedElementSelector are required for element edits.');
    }

    if (request.requestKind === 'multi-section-edit' && (!request.targetBlockIds || request.targetBlockIds.length === 0)) {
        throw new Error('targetBlockIds are required for multi-section edits.');
    }
}

export async function runModificationEngine(
    request: InternalModificationRequest,
    runtime: EngineRuntime,
): Promise<ModificationEngineResponse> {
    validateModificationRequest(request);
    logger.action('Modification engine start', {
        requestKind: request.requestKind,
        blockCount: request.blocks.length,
        selectedBlockId: request.selectedBlockId || null,
        targetBlockIds: request.targetBlockIds || [],
    });

    const operations: ModificationEngineResponse['operations'] = [];
    let summary = 'Applied modification.';
    let executorMode: ModificationExecutorMode = 'full-html';

    if (request.requestKind === 'remove-section') {
        const targetBlockId = request.selectedBlockId || request.targetBlockIds?.[0] || null;
        if (!targetBlockId) {
            throw new Error('No block selected for removal.');
        }

        const block = getBlockById(request.blocks, targetBlockId);
        if (!block) {
            throw new Error('Selected block was not found.');
        }

        operations.push(
            { type: 'remove-block', blockId: block.id },
            { type: 'select-block', blockId: null },
        );
        summary = `Removed ${block.label}.`;
        executorMode = 'remove';
    } else if (request.requestKind === 'add-section') {
        const result = await executeAddSection({
            prompt: request.prompt,
            blocks: request.blocks,
            runtime,
            designStylePrompt: request.designStylePrompt,
            projectContext: request.projectContext,
        });
        const afterBlockId = request.selectedBlockId || request.blocks[request.blocks.length - 1]?.id || null;
        operations.push(
            { type: 'insert-block', afterBlockId, block: result.block },
            { type: 'select-block', blockId: result.block.id },
        );
        summary = result.summary;
        executorMode = 'full-html';
    } else if (request.requestKind === 'element-edit') {
        const block = getBlockById(request.blocks, request.selectedBlockId);
        if (!block) {
            throw new Error('Selected block was not found.');
        }

        if (!request.selectedElementHtml) {
            throw new Error('selectedElementHtml is required for element edits.');
        }

        const result = await executeElementEdit({
            prompt: request.prompt,
            block,
            selectedElementHtml: request.selectedElementHtml,
            runtime,
            designStylePrompt: request.designStylePrompt,
            projectContext: request.projectContext,
        });
        const reviewedHtml = reviewUpdatedBlockHtml(result.html, block.id);
        operations.push(
            { type: 'update-block', blockId: block.id, html: reviewedHtml },
            { type: 'select-block', blockId: block.id },
        );
        summary = result.summary;
        executorMode = 'element-html';
    } else if (request.requestKind === 'global-style-edit') {
        const nextStyleId = inferStyleIdFromPrompt(request.prompt);
        const nextStylePrompt = nextStyleId
            ? DESIGN_STYLES.find((style) => style.id === nextStyleId)?.prompt
            : request.designStylePrompt;

        const updateOperations: ModificationEngineResponse['operations'] = [];
        for (const block of request.blocks) {
            const result = await executeFullBlockEdit({
                prompt: request.prompt,
                block,
                runtime,
                designStylePrompt: nextStylePrompt,
                projectContext: request.projectContext,
                globalStyle: true,
            });
            updateOperations.push({
                type: 'update-block',
                blockId: block.id,
                html: reviewUpdatedBlockHtml(result.html, block.id),
            });
        }

        operations.push(...updateOperations);
        if (nextStyleId) {
            operations.push({ type: 'set-design-style', designStyle: nextStyleId });
        }
        if (request.selectedBlockId) {
            operations.push({ type: 'select-block', blockId: request.selectedBlockId });
        }
        summary = nextStyleId
            ? `Updated the page to the ${DESIGN_STYLES.find((style) => style.id === nextStyleId)?.label || nextStyleId} style.`
            : 'Updated the page styling across existing sections.';
        executorMode = 'full-html';
    } else if (request.requestKind === 'multi-section-edit') {
        const targetBlocks = (request.targetBlockIds || [])
            .map((blockId) => getBlockById(request.blocks, blockId))
            .filter((block): block is Block => Boolean(block));

        if (targetBlocks.length === 0) {
            throw new Error('No target blocks were found for the multi-section edit.');
        }

        let usedFullRewrite = false;
        for (const block of targetBlocks) {
            const mode = chooseSectionEditExecutorMode(request.prompt);
            let result: { html: string; summary: string };

            if (mode === 'patch') {
                try {
                    result = await executePatchEdit({
                        prompt: request.prompt,
                        block,
                        runtime,
                    });
                } catch (error) {
                    logger.error('Modification engine multi-edit patch fallback', error);
                    usedFullRewrite = true;
                    result = await executeFullBlockEdit({
                        prompt: `This is a multi-section edit. Update only the "${block.label}" section while keeping other targeted sections conceptually aligned.\n\nUser request: ${request.prompt}`,
                        block,
                        runtime,
                        designStylePrompt: request.designStylePrompt,
                        projectContext: request.projectContext,
                    });
                }
            } else {
                usedFullRewrite = true;
                result = await executeFullBlockEdit({
                    prompt: request.prompt,
                    block,
                    runtime,
                    designStylePrompt: request.designStylePrompt,
                    projectContext: request.projectContext,
                });
            }

            operations.push({
                type: 'update-block',
                blockId: block.id,
                html: reviewUpdatedBlockHtml(result.html, block.id),
            });
        }

        if (request.selectedBlockId) {
            operations.push({ type: 'select-block', blockId: request.selectedBlockId });
        }
        summary = `Updated ${targetBlocks.length} sections.`;
        executorMode = usedFullRewrite ? 'full-html' : 'patch';
    } else {
        const block = getBlockById(request.blocks, request.selectedBlockId);
        if (!block) {
            throw new Error('Selected block was not found.');
        }

        const preferredMode = chooseSectionEditExecutorMode(request.prompt);
        let result: { html: string; summary: string };

        if (preferredMode === 'patch') {
            try {
                result = await executePatchEdit({
                    prompt: request.prompt,
                    block,
                    runtime,
                });
                executorMode = 'patch';
            } catch (error) {
                logger.error('Modification engine section patch fallback', error);
                result = await executeFullBlockEdit({
                    prompt: request.prompt,
                    block,
                    runtime,
                    designStylePrompt: request.designStylePrompt,
                    projectContext: request.projectContext,
                });
                executorMode = 'full-html';
            }
        } else {
            result = await executeFullBlockEdit({
                prompt: request.prompt,
                block,
                runtime,
                designStylePrompt: request.designStylePrompt,
                projectContext: request.projectContext,
            });
            executorMode = 'full-html';
        }

        operations.push(
            {
                type: 'update-block',
                blockId: block.id,
                html: reviewUpdatedBlockHtml(result.html, block.id),
            },
            { type: 'select-block', blockId: block.id },
        );
        summary = result.summary;
    }

    const nextBlocks = applyModificationOperationsToBlocks(request.blocks, operations);
    assertUniqueRootIds(nextBlocks);

    if (nextBlocks.some((block) => !extractBlockIdFromHtml(block.html))) {
        throw new Error('All blocks must preserve a root data-block-id.');
    }

    logger.action('Modification engine complete', {
        requestKind: request.requestKind,
        executorMode,
        operationCount: operations.length,
    });

    return {
        summary,
        executorMode,
        operations,
    };
}

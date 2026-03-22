import { Block, ModificationEngineOperation } from '@/types';

export function applyModificationOperationsToBlocks(
    blocks: Block[],
    operations: ModificationEngineOperation[],
): Block[] {
    let nextBlocks = blocks.map((block) => ({ ...block }));

    for (const operation of operations) {
        switch (operation.type) {
            case 'update-block':
                nextBlocks = nextBlocks.map((block) =>
                    block.id === operation.blockId
                        ? { ...block, html: operation.html }
                        : block,
                );
                break;
            case 'insert-block': {
                const nextBlock = { ...operation.block, visible: operation.block.visible !== false };
                if (!operation.afterBlockId) {
                    nextBlocks = [...nextBlocks, nextBlock];
                    break;
                }

                const index = nextBlocks.findIndex((block) => block.id === operation.afterBlockId);
                if (index === -1) {
                    nextBlocks = [...nextBlocks, nextBlock];
                    break;
                }

                const updated = [...nextBlocks];
                updated.splice(index + 1, 0, nextBlock);
                nextBlocks = updated;
                break;
            }
            case 'remove-block':
                nextBlocks = nextBlocks.filter((block) => block.id !== operation.blockId);
                break;
            default:
                break;
        }
    }

    return nextBlocks;
}

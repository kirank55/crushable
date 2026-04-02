export function buildProjectContext(userBrief: string, productDescription?: string, brandName?: string): string {
    const trimmedBrief = userBrief.trim();
    const trimmedDescription = productDescription?.trim() || '';
    const trimmedBrandName = brandName?.trim() || '';

    const contextLines: string[] = [];

    if (trimmedBrandName) {
        contextLines.push(
            'Resolved brand name:',
            trimmedBrandName,
            '',
            `Use "${trimmedBrandName}" exactly for the visible brand/logo text in the navbar, header, and footer.`,
            'Do not invent, abbreviate, or substitute a different brand name.',
            '',
        );
    }

    if (!trimmedDescription || trimmedDescription === trimmedBrief) {
        contextLines.push('Original user brief:', trimmedBrief);
        return contextLines.join('\n');
    }

    contextLines.push(
        'Original user brief:',
        trimmedBrief,
        '',
        'Normalized product description:',
        trimmedDescription,
    );

    return contextLines.join('\n');
}
module.exports = function extractMentions(message) {
    try {
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        const mentions = {};
        let match;

        while ((match = mentionRegex.exec(message)) !== null) {
            const key = `${match[1]}-${match[2]}`;

            if (!mentions[key]) {
                mentions[key] = {
                    username: match[1],
                    id: match[2]
                };
            }
        }

        return Object.values(mentions);
    } catch (error) {
        console.error(`An error occurred at extractMentions module: ${error}`);
        return [];
    }
}
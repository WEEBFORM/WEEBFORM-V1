import GeminiConnector from "../core/GeminiConnector.js";
import DatabaseConnector from "../core/DatabaseConnector.js";

class SearchAppDataIntent {
    constructor(geminiConnector, databaseConnector) {
        this.geminiConnector = geminiConnector;
        this.databaseConnector = databaseConnector;
    }

    async execute(message) {
        try {
            const searchTerms = message.replace(/search\s+for\s+|find\s+|look\s+up\s+/i, '').trim();

            if (!searchTerms || searchTerms.length < 3) {
                return "Please provide more specific search terms (at least 3 characters).";
            }
            const prompt = `
                Given the following search request in an anime social media app, create a safe SQL query to search relevant data.
                Available tables: users, posts, communities, comments, stories, stores, catalogue_items, replies.

                Search request: "${searchTerms}"

                Rules:
                1. Only use SELECT statements (no INSERT, UPDATE, DELETE, etc.)
                2. Limit results to 10 items
                3. Use parameterized queries with '?' for user input
                4. Don't use any schema-modifying statements
                5. Include only basic fields like id, title, username, content, etc.

                Return only the SQL query without any explanation.
            `;

            const response = await this.geminiConnector.generateContent(prompt);
            const sqlQuery = response.trim();

            if (!sqlQuery.toLowerCase().startsWith('select')) {
                return "Gomen nasai! I can only perform safe search operations.";
            }

            console.log("Generated SQL Query:", sqlQuery);

            const params = [];
            const parameterizedQuery = sqlQuery.replace(/'([^']+)'/g, (match, p1) => {
                if (p1.includes(searchTerms)) {
                    params.push(`%${searchTerms}%`);
                    return '?';
                }
                return match;
            });
            console.log(parameterizedQuery, params);

            // Execute the generated SQL query
            const results = await this.databaseConnector.query(parameterizedQuery, params)
            if (results && results.length > 0) {
                // Format the results nicely
                let formattedResults = "# Search Results\n\n";

                results.forEach((item, index) => {
                    formattedResults += `## Result ${index + 1}\n`;
                    for (const [key, value] of Object.entries(item)) {
                        // Skip long text fields in the summary
                        if (typeof value === 'string' && value.length > 100) {
                            formattedResults += `**${key}**: ${value.substring(0, 100)}...\n`;
                        } else {
                            formattedResults += `**${key}**: ${value}\n`;
                        }
                    }
                    formattedResults += '\n';
                });

                return formattedResults;
            } else {
                return "No results found matching your search. Try different keywords!";
            }

        } catch (error) {
            console.error("App Data Search Error:", error);
            return "Error searching app data. Please try again with different keywords.";
        }
    }
}

export default SearchAppDataIntent;
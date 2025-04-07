//@ weebAI/intents/TrendingPostsIntent.js
import DatabaseConnector from "../core/DatabaseConnector.js";

class TrendingPostsIntent {
  constructor(databaseConnector) {
    this.databaseConnector = databaseConnector;
  }

  async execute() {
    try {
      const query = `
        SELECT 
          p.id,
          p.description,
          COUNT(l.id) AS likeCount,
          COUNT(c.id) AS commentCount
        FROM posts p
        LEFT JOIN likes l ON p.id = l.postId
        LEFT JOIN comments c ON p.id = c.postId
        GROUP BY p.id
        ORDER BY (likeCount + commentCount) DESC
        LIMIT 5;
      `;

      const results = await this.databaseConnector.query(query);

      if (results.length === 0) {
        return "Looks like things are quiet right now...no trending posts at the moment!";
      }

      let response = "# Top 5 Trending Posts:\n\n";
      results.forEach((post, index) => {
        response += `${index + 1}. **Post #${post.id}**\n`;
        response += `   Likes: ${post.likeCount}, Comments: ${post.commentCount}\n`;
        response += `   Description: ${post.description.substring(0, 100)}...\n\n`;
      });

      return response;
    } catch (error) {
      console.error("Error fetching trending posts:", error);
      return "Uwah! I couldn't retrieve the trending posts right now. Try again later!";
    }
  }
}

export default TrendingPostsIntent;
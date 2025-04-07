//@ weebAI/intents/UserStatsIntent.js
import DatabaseConnector from "../core/DatabaseConnector.js";

class UserStatsIntent {
  constructor(databaseConnector) {
    this.databaseConnector = databaseConnector;
  }

  async execute(message) {
    // Extract the target username
    const usernameMatch = message.match(/stats\s+for\s+@?([a-zA-Z0-9_]+)/i) ||
      message.match(/user\s+@?([a-zA-Z0-9_]+)\s+stats/i) ||
      message.match(/@?([a-zA-Z0-9_]+)\s+statistics/i);

    const username = usernameMatch?.[1]?.trim();

    if (!username) {
      return "Whose stats are you curious about? Please specify a valid username!";
    }

    try {
      const query = `
        SELECT 
          u.id,
          u.username,
          u.full_name,
          (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postCount,
          (SELECT COUNT(*) FROM comments WHERE userId = u.id) AS commentCount,
          (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
          (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount
        FROM users u
        WHERE LOWER(u.username) = LOWER(?)
      `;

      const results = await this.databaseConnector.query(query, [username]);

      if (results.length === 0) {
        return `Sorry, I couldn't find a user with the username @${username}. Double-check your spelling!`;
      }

      const userStats = results[0];

      const response = `
        # @${username}'s Stats:
        - Full Name: ${userStats.full_name}
        - Total Posts: ${userStats.postCount}
        - Total Comments: ${userStats.commentCount}
        - Followers: ${userStats.followerCount}
        - Following: ${userStats.followingCount}

        ${userStats.postCount > 100 ? "They're a Weebform superstar! :star:" : ""}
      `;

      return response;
    } catch (error) {
      console.error("Error fetching user stats:", error);
      return "Gomen! Something went wrong while retrieving the user stats. Please try again later.";
    }
  }
}

export default UserStatsIntent;
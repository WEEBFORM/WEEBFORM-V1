# **WeebForm API Documentation**

## **Overview**
This document provides a detailed overview of the API endpoints available in the WeebForm backend. It includes endpoints for managing stores, news content, communities, chat groups, messages, and more. The documentation is designed to help frontend developers and other stakeholders understand the backend features and integrate them effectively.

---

## **Base URL**
All endpoints are prefixed with `/api/v1`.

---

## **Table of Contents**
1. [Authentication](#authentication)
2. [Health Check](#health-check)
3. [Stores](#stores)
4. [News Content](#news-content)
5. [Community Section](#community-section)
   - [Community Management](#community-management)
   - [Community Feed](#community-feed)
   - [Chat Group Management](#chat-group-management)
   - [Message Management](#message-management)
   - [Moderation Tools](#moderation-tools)
   - [Gamification](#gamification)
6. [Error Handling](#error-handling)
7. [Environment Variables](#environment-variables)

---

## **1. Authentication**
### **Middleware**
- **`authenticateUser`**: Protects routes by verifying JWT tokens. All protected routes require the `Authorization` header with a valid token.

### **Token Header**
- `Authorization: Bearer <token>`

---

## **2. Health Check**
### **Endpoint**
- **GET** `/health`

### **Description**
Checks the health of the backend, including database connectivity.

### **Response**
- **200 OK**: `{ status: "healthy", timestamp: "<current timestamp>" }`
- **500 Internal Server Error**: `{ status: "degraded", error: "<error message>" }`

---

## **3. Stores**
### **Base Path**: `/api/v1/stores`

| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **GET**  | `/`                               | Fetch all stores.                             |
| **POST** | `/create`                         | Create a new store.                           |
| **GET**  | `/:id`                            | Fetch details of a specific store.            |
| **PUT**  | `/:id`                            | Update a store's details.                     |
| **DELETE** | `/:id`                          | Delete a store.                               |

---

## **4. News Content**
### **Base Path**: `/api/v1/news-content`

| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **GET**  | `/`                               | Fetch all news articles.                      |
| **POST** | `/create`                         | Create a new news article.                    |
| **GET**  | `/:id`                            | Fetch details of a specific news article.     |
| **PUT**  | `/:id`                            | Update a news article.                        |
| **DELETE** | `/:id`                          | Delete a news article.                        |

---

## **5. Community Section**
The Community Section provides APIs for managing communities, chat groups, messages, and user interactions. It includes features like authentication, media uploads, moderation tools, and gamification.

### **Base Path**: `/api/v1/communities`

### **5.1 Community Management**
| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **POST** | `/create`                         | Create a new community.                      |
| **GET**  | `/`                               | Fetch all communities.                       |
| **GET**  | `/existing/joined`                | Fetch communities the user has joined.       |
| **GET**  | `/:id`                            | Fetch details of a specific community.       |
| **POST** | `/join/:id`                       | Join a community.                            |
| **DELETE** | `/leave/:id`                    | Leave a community.                           |
| **DELETE** | `/:id`                          | Delete a community.                          |

---

### **5.2 Community Feed**
| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **POST** | `/:id/new-post`                   | Create a post in the community feed.         |
| **GET**  | `/:id/community-feed`             | Fetch posts in the community feed.           |
| **DELETE** | `/community-feed/:id`           | Delete a specific post.                      |

---

### **5.3 Chat Group Management**
| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **POST** | `/community/:communityId/groups`  | Create a new chat group in a community.      |
| **PUT**  | `/:chatGroupId`                   | Edit a chat group.                           |
| **DELETE** | `/:chatGroupId`                 | Delete a chat group.                         |
| **GET**  | `/community/:communityId/all`     | Fetch all chat groups in a community.        |
| **GET**  | `/community/:communityId/my-groups`| Fetch chat groups the user has joined.       |
| **POST** | `/join/:chatGroupId`              | Join a specific chat group.                  |
| **DELETE** | `/:chatGroupId/leave`           | Leave a specific chat group.                 |

---

### **5.4 Message Management**
| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **POST** | `/upload`                         | Upload media for a message.                  |
| **GET**  | `/:chatGroupId`                   | Fetch all messages in a chat group.          |
| **PUT**  | `/:messageId`                     | Edit a specific message.                     |
| **DELETE** | `/:messageId`                   | Delete a specific message.                   |

---

### **5.5 Moderation Tools**
| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **POST** | `/moderation/mute`               | Mute a user in a chat group.                 |
| **POST** | `/moderation/ban`                | Ban a user from a community or chat group.   |
| **POST** | `/moderation/slow-mode`          | Apply slow mode to a chat group.             |
| **POST** | `/moderation/exile`              | Temporarily move a user to a filler room.    |

---

### **5.6 Gamification**
| Method | Endpoint                          | Description                                   |
|--------|-----------------------------------|-----------------------------------------------|
| **GET**  | `/gamification/activity`         | Fetch user activity and points.              |
| **GET**  | `/gamification/level`            | Fetch user level and progress.               |

---

## **6. Error Handling**
- All endpoints return appropriate HTTP status codes:
  - `200`: Success.
  - `400`: Bad request (e.g., missing parameters).
  - `401`: Unauthorized (e.g., invalid token).
  - `404`: Not found (e.g., invalid resource ID).
  - `500`: Internal server error.

---

## **7. Environment Variables**
Ensure the following environment variables are set in your `.env` file:
- `PORT`: Port number for the server.
- `DB_HOST`: Database host.
- `DB_USER`: Database username.
- `DB_PASSWORD`: Database password.
- `DB_NAME`: Database name.
- `REDIS_URL`: Redis connection URL.
- `BUCKET_NAME`: AWS S3 bucket name.
- `BUCKET_REGION`: AWS S3 bucket region.
- `AWS_ACCESS_KEY_ID`: AWS access key ID.
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key.

---

## **Notes**
- Replace placeholders like `<id>` and `<chatGroupId>` with actual IDs when making requests.
- Use tools like Postman or a custom frontend app to test the endpoints.

---

## **Conclusion**
 
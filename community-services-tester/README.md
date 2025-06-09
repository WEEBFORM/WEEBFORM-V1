# Community Services Tester

This project is a React application designed to test community services and features. It includes a simple login for user authentication to access various endpoints from the server.

## Project Structure

```
community-services-tester
├── public
│   ├── index.html          # Main HTML file for the React application
├── src
│   ├── components
│   │   ├── LoginForm.jsx   # Component for user login
│   │   ├── CommunityGroups.jsx # Component to display community services
│   ├── services
│   │   ├── api.js          # API service for making requests to the backend
│   ├── App.jsx             # Main application component
│   ├── index.js            # Entry point for the React application
│   └── styles
│       └── App.css         # Styles for the application
├── package.json            # npm configuration file
├── .env                    # Environment variables
├── .gitignore              # Files and directories to ignore by Git
└── README.md               # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd community-services-tester
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory and add the following:
   ```
   REACT_APP_API_BASE_URL=<your_api_base_url>
   ```

4. **Run the application:**
   ```
   npm start
   ```

5. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`.

## Usage

- Use the `LoginForm` component to authenticate users.
- Once logged in, the `CommunityGroups` component will fetch and display community services and features.
- Ensure that the backend server is running and accessible for API requests.

## Contributing

Feel free to submit issues or pull requests for improvements and bug fixes.
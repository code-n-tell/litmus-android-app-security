<img width="1376" height="768" alt="Gemini_Generated_Image_9cgin39cgin39cgi" src="https://github.com/user-attachments/assets/baa7f850-9b1f-4096-8a32-707d99b7c468" />

# 🧭 About
Litmus is a tool that centralises security findings into an easy-to-use dashboard. It highlights trends to help decision-makers prioritise security efforts and provides stakeholders with clear testing steps and actionable remediation recommendations.

# ✨ Features
As a user,
- [X] I want to record findings from my Android security testing so that evidence and observations are centrally documented
- [X] I want to translate findings into insights so stakeholders can make informed, data-driven decisions
- [X] I want to visualise the severity and impact of findings so that they are prioritised promptly
- [X] I want to deliver findings & recommendations to stakeholders via email so that teams can take remediation action

# 👩‍💻 Developer Setup
## 📦 Prerequisites
Before you begin, ensure your local machine have the following installed:
- [Node.js](https://nodejs.org/) v18+
- A terminal that supports two concurrent sessions (e.g. Windows Terminal, VS Code integrated terminal)

## 🚀 Getting Started
### 1. Install dependencies

Clone or download the project, then from the project root:

```bash
npm install
```

### 2. Start the API server

The API server reads and writes findings to the local SQLite database (`data/dashboard.db`).

```bash
npm run api
```

You should see:
```
API listening on http://127.0.0.1:8787
```

> The default port is `8787`. To use a different port, set the `API_PORT` environment variable before running.

### 3. Start the frontend

In a **second terminal**, from the same project root:

```bash
npx vite
```

You should see:
```
VITE ready in Xms
➜  Local:   http://localhost:5173/
```

### 4. Open the dashboard

Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

The dashboard loads live data from the API. Both the API server and frontend must be running simultaneously.

## 📂 Project Structure

```
android-dashboard/
├── data/
│   └── dashboard.db        # SQLite database (pre-seeded)
├── server/                 # Express API server
├── src/
│   └── App.jsx             # Main React app + default dataset
├── package.json
└── vite.config.js
```
# 🤝 Contributing
Contributions are welcome and appreciated! If you wish to improve this project:
- Fork the repo
- Create a feature branch
- Commit your Changes
- Push to your Branch
- Open a Pull Request

# 📄 License
This project is released under the MIT License, which means you are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, as long as you include the original copyright notice. The software is provided “as is,” without warranty of any kind, either express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, or non-infringement. For full details, please refer to the [License](./LICENSE).

# 🙏 Acknowledgements
- Cybersecurity software engineer, Xavier Lim
- Product delivery manager, Gerald Lau

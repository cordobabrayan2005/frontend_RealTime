/* The code snippet you provided is importing necessary modules and components for a TypeScript React
application. Here's a breakdown of each import statement: */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.scss";

/* This code snippet is using ReactDOM's experimental createRoot API to render the React application.
Here's a breakdown of what it does: */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

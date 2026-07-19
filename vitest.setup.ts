import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollTo; stub it so view transitions stay quiet.
window.scrollTo = () => {};

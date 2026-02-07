# README

This project is a website for students to practice their intuition on hand-crafting neural networks (modifying the weights and biases manually) to fit functions.

## File Structure

- `src/` - Frontend app source for the neural-network builder.
  - `src/App.jsx` - Main orchestration layer that wires app state, challenge flow, and feature components.
  - `src/main.jsx` - React entry point that mounts `App`.
  - `src/index.css` - Global baseline styles loaded once at startup.
  - `src/App.css` - Legacy Vite template styles (currently not required by app logic).
  - `src/assets/` - Static assets used by the UI.
  - `src/styles/theme.js` - Shared color tokens and reusable inline button style objects.
  - `src/lib/networkMath.js` - Core network math, parameter draft parsing/sync, cloning, and interpolation helpers.
  - `src/lib/heatmap.js` - Heatmap grid sampling, scoring math support utilities, and canvas rendering helpers.
  - `src/features/challenges/challenges.js` - Challenge catalog and canonical solution factories.
  - `src/features/challenges/score.js` - Challenge match-score labels and gradient color mapping.
  - `src/components/ChallengeThumbnail.jsx` - Small canvas preview for challenge cards.
  - `src/components/ChallengeLibrary.jsx` - Sidebar challenge UI that keeps the full challenge list visible and highlights the selected challenge.
  - `src/components/InspectorSidebar.jsx` - Floating neuron inspector menu for editing selected neuron inputs, biases, and weights.
  - `src/components/NetworkGraph.jsx` - SVG network graph renderer with draggable height handle.
  - `src/components/HeatmapPanel.jsx` - Output/challenge comparison heatmap panel and challenge action controls.

- `README.md` - Source-of-truth map for this structure. If you add, remove, or repurpose files/directories, update this document in the same change.

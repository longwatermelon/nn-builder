# README

This project is a website for students to practice their intuition on hand-crafting neural networks (modifying the weights and biases manually) to fit functions.

## Summary

- A **challenge** is one target function from the catalog (for example `f(x_1, x_2) = x_1 + x_2`) that the user tries to match.
- The **challenge library** is the left sidebar list of challenges; picking one enters **challenge mode**.
- The **editor** is the central workbench and has three parts: the **layers bar** (architecture controls), the **network view** (visual graph + neuron selection), and the **neuron inspector** (numeric controls for the selected neuron).
- The **results area** sits below the editor and reflects model behavior: in challenge mode it is titled **Challenge Matchup** and shows score + network-vs-target heatmaps; with no challenge selected (**sandbox mode**) it shows the live output heatmap with the header **Output Heatmap · f(x_1, x_2)**.
- A user's current **attempt** means the active network state (inputs, layers, weights, and biases) they are iterating on.

## File Structure

- `src/` - Frontend app source for the neural-network builder.
  - `src/App.jsx` - Main orchestration layer that wires challenge mode/sandbox mode, editor interactions, and results area state.
  - `src/main.jsx` - React entry point that mounts `App`.
  - `src/index.css` - Global baseline styles loaded once at startup.
  - `src/styles/theme.js` - Shared color tokens and reusable inline button style objects.
  - `src/lib/clipboard.js` - Shared clipboard-copy helper with API fallback handling.
  - `src/lib/networkStructure.js` - Network topology edit helpers and weight-count utilities.
  - `src/lib/networkMath.js` - Core network math and helpers for parsing/syncing attempt parameters.
  - `src/lib/heatmap.js` - Heatmap grid sampling, scoring math support utilities, and canvas rendering helpers.
  - `src/features/challenges/challenges.js` - Challenge catalog (each challenge is one target function) and canonical solution factories.
  - `src/features/challenges/score.js` - Challenge match-score labels and gradient color mapping.
  - `src/components/MathText.jsx` - Shared KaTeX renderer for math expressions in the UI.
  - `src/components/ChallengeThumbnail.jsx` - Small canvas preview for challenge cards.
  - `src/components/ChallengeLibrary.jsx` - Challenge library (left sidebar challenge list with selection + solved state).
  - `src/components/NeuronInspector.jsx` - Neuron inspector portion of the editor for editing selected neuron inputs, biases, and weights.
  - `src/components/NetworkView.jsx` - Network view portion of the editor: SVG network graph + neuron selection.
  - `src/components/ResultsPanel.jsx` - Results area: challenge matchup view or sandbox output heatmap view.

- `README.md` - Source-of-truth map for this structure. If you add, remove, or repurpose files/directories, update this document in the same change.

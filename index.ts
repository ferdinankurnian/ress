import { Platform } from "react-native";
import { registerRootComponent } from "expo";
import React from "react";
// Headless widget tasks do not need to initialize the reader UI or its fonts.
function App() {
  const Reader = require("./App").default;
  return React.createElement(Reader);
}
import { registerWidgets } from "./src/widget/bridge";
registerWidgets();
registerRootComponent(App);

if (Platform.OS === "web") require("./global.css");

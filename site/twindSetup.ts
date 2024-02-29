import presetAutoprefix from "@twind/preset-autoprefix";
import presetTailwind from "@twind/preset-tailwind";
import presetTypography from "@twind/preset-typography";
import meta from "./meta.json" assert { type: "json" };

export default {
  presets: [presetAutoprefix(), presetTailwind(), presetTypography()],
  rules: [
    ["btn", "font-bold py-2 px-4 rounded"],
    ["btn-blue", "bg-blue-500 hover:bg-blue-700 text-white"],
    ["btn-muted", "font-light text-gray-500"],
    // https://twind.style/rules#static-rules
    ["mask-text", { color: "transparent", textShadow: "0 0 black" }],
    // For navigation
    ["pointer-events-all", { pointerEvents: "all" }],
  ],
  theme: {
    extend: {
      colors: meta.colors,
    },
  },
  hash: false,
};

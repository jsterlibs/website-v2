export default {
  content: [
    "./site/**/*.{html,ts}",
    "./data/blogposts/**/*.{md,yml}",
    "./data/libraries/**/*.json",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3a2fa6",
        secondary: "#84ebec",
        tertiary: "#ffffff",
      },
    },
  },
};

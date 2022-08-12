export default ({
  twindColors,
  twindTypography,
}: {
  twindColors: unknown;
  twindTypography: () => Record<string, unknown>;
}) => ({
  theme: { extend: { colors: twindColors } },
  plugins: {
    ...twindTypography(),
  },
});

function init() {
  return {
    calculateCircumference(radius: number) {
      return radius * 2 * Math.PI;
    },
    calculateDashOffset(radius: number, value: number) {
      const circumference = radius * 2 * Math.PI;

      return circumference - circumference * value;
    },
  };
}

export { init };

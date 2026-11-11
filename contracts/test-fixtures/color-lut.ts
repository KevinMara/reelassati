export function cubeFixture(size = 3) {
  const lines = [`TITLE "Numeric test grid"`, `LUT_3D_SIZE ${size}`];
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const red = r / (size - 1),
          green = g / (size - 1),
          blue = b / (size - 1);
        lines.push(
          `${0.1 + blue * 0.8} ${red * green} ${Math.sqrt(red) * 0.7 + green * 0.2}`
        );
      }
  return lines.join("\n");
}

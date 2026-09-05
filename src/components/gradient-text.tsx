import { Text } from 'ink';
import { neonGradientColor } from '../neon-gradient.js';

interface GradientTextProps {
  children: string;
  bold?: boolean;
}

/**
 * Colors arbitrary text left-to-right along the neon gradient, one letter
 * per cell. Copied from arch-terminal's `GradientText`.
 */
export function GradientText({ children, bold = true }: GradientTextProps) {
  const letters = children.split('');

  return (
    <Text bold={bold}>
      {letters.map((letter, index) => (
        <Text
          // biome-ignore lint/suspicious/noArrayIndexKey: renders each character of a fixed string once per render
          key={index}
          color={neonGradientColor(letters.length <= 1 ? 0 : index / (letters.length - 1))}
        >
          {letter}
        </Text>
      ))}
    </Text>
  );
}

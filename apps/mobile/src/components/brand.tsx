import { Image } from 'react-native';

/**
 * The real PassPath mark — winding road rising into a green checkmark-arrow
 * (assets/logo-mark.png, transparent background). Used on the splash screen,
 * welcome carousel and auth screens. The same artwork feeds the OS app icon.
 */
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/logo-mark.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

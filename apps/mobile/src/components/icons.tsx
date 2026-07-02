import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

interface IconProps {
  size?: number;
  color?: string;
}

const S = ({ size = 22, color = colors.ink400, children }: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const Home = (p: IconProps) => (
  <S {...p}>
    <Path d="M3 10.5 12 3l9 7.5" />
    <Path d="M5 9.5V21h14V9.5" />
    <Path d="M9.5 21v-6h5v6" />
  </S>
);

export const Book = (p: IconProps) => (
  <S {...p}>
    <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <Path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
  </S>
);

export const Calculator = (p: IconProps) => (
  <S {...p}>
    <Path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <Path d="M8 7h8" />
    <Path d="M8 11h.01M12 11h.01M16 11h.01M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01" />
  </S>
);

export const Grid = (p: IconProps) => (
  <S {...p}>
    <Circle cx={7} cy={7} r={1.6} />
    <Circle cx={17} cy={7} r={1.6} />
    <Circle cx={7} cy={17} r={1.6} />
    <Circle cx={17} cy={17} r={1.6} />
  </S>
);

export const Bell = (p: IconProps) => (
  <S {...p}>
    <Path d="M6 9a6 6 0 1 1 12 0c0 3.5 1 4.5 1.8 5.6.4.6 0 1.4-.8 1.4H5c-.8 0-1.2-.8-.8-1.4C5 13.5 6 12.5 6 9z" />
    <Path d="M10 20a2 2 0 0 0 4 0" />
  </S>
);

export const Briefcase = (p: IconProps) => (
  <S {...p}>
    <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
    <Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    <Path d="M4 12h16" />
  </S>
);

export const FileText = (p: IconProps) => (
  <S {...p}>
    <Path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <Path d="M14 3v4h4" />
    <Path d="M9 12.5h6M9 16h4" />
  </S>
);

export const Timer = (p: IconProps) => (
  <S {...p}>
    <Circle cx={12} cy={13} r={8} />
    <Path d="M12 13V9.5" />
    <Path d="M9.5 2h5" />
  </S>
);

export const GradCap = (p: IconProps) => (
  <S {...p}>
    <Path d="M12 4 2 9l10 5 10-5z" />
    <Path d="M6 11v4c0 1.2 2.7 3 6 3s6-1.8 6-3v-4" />
    <Path d="M22 9v5" />
  </S>
);

export const Search = (p: IconProps) => (
  <S {...p}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M21 21l-4.3-4.3" />
  </S>
);

export const Flask = (p: IconProps) => (
  <S {...p}>
    <Path d="M9.5 3h5" />
    <Path d="M10.5 3v6.5L5.6 18a1 1 0 0 0 .9 1.5h11a1 1 0 0 0 .9-1.5L13.5 9.5V3" />
    <Path d="M8 14h8" />
  </S>
);

export const Leaf = (p: IconProps) => (
  <S {...p}>
    <Path d="M4 20C4 11 11 4 20 4c0 9-7 16-16 16z" />
    <Path d="M4.5 19.5C8 14 12 11.5 16.5 10.5" />
  </S>
);

export const BarChart = (p: IconProps) => (
  <S {...p}>
    <Path d="M5 21V11M12 21V5M19 21v-6" />
  </S>
);

export const Calendar = (p: IconProps) => (
  <S {...p}>
    <Path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    <Path d="M5 9h14M8 3v3M16 3v3" />
    <Path d="M8.5 13h2M13.5 13h2M8.5 16.5h2M13.5 16.5h2" />
  </S>
);

export const Clipboard = (p: IconProps) => (
  <S {...p}>
    <Path d="M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    <Path d="M9 4h6v3H9z" />
    <Path d="M8.5 11h7M8.5 15h4" />
  </S>
);

export const Compass = (p: IconProps) => (
  <S {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="m15.5 8.5-2 5-5 2 2-5z" />
  </S>
);

export const User = (p: IconProps) => (
  <S {...p}>
    <Circle cx={12} cy={8} r={3.5} />
    <Path d="M5 20a7 7 0 0 1 14 0" />
  </S>
);

export const Flame = (p: IconProps) => (
  <S {...p}>
    <Path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.6-2.4 1.3-3.2C10 9 11.5 8 12 3Z" />
  </S>
);

export const Clock = (p: IconProps) => (
  <S {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7.5V12l3 2" />
  </S>
);

export const Target = (p: IconProps) => (
  <S {...p}>
    <Circle cx={12} cy={12} r={8.5} />
    <Circle cx={12} cy={12} r={4.5} />
    <Circle cx={12} cy={12} r={1} fill={p.color ?? colors.ink400} stroke="none" />
  </S>
);

export const TrendUp = (p: IconProps) => (
  <S {...p}>
    <Path d="M4 15.5 9.5 10l3 3L20 6" />
    <Path d="M15 6h5v5" />
  </S>
);

export const Check = (p: IconProps) => (
  <S {...p}>
    <Path d="m5 12.5 4 4 10-10" />
  </S>
);

export const ChevronRight = (p: IconProps) => (
  <S {...p}>
    <Path d="m9 6 6 6-6 6" />
  </S>
);

export const Bulb = (p: IconProps) => (
  <S {...p}>
    <Path d="M9 18h6M10 21h4" />
    <Path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.5.8.5 1.6h6c0-.8 0-1.2.5-1.6A6 6 0 0 0 12 3Z" />
  </S>
);

export const Play = (p: IconProps) => (
  <S {...p}>
    <Path d="M8 5.5v13l11-6.5z" />
  </S>
);

export const Logout = (p: IconProps) => (
  <S {...p}>
    <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <Path d="M10 12h10M17 9l3 3-3 3" />
  </S>
);

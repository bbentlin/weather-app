import React from "react";
import {
  Sun, Moon, Cloud, CloudSun, CloudMoon, CloudFog,
  CloudRain, CloudSnow, CloudLightning,
} from "phosphor-react";

type Props = {
  code: number;
  isDay?: boolean;            // true=day, false=night
  size?: number;              // px
  className?: string;         // tailwind color/size
  title?: string;
};

const WMO = {
  CLEAR: [0],
  MAINLY_CLEAR: [1],
  PARTLY_CLOUDY: [2],
  OVERCAST: [3],
  FOG: [45, 48],
  DRIZZLE: [51, 53, 55, 56, 57],
  RAIN: [61, 63, 65, 66, 67, 80, 81, 82],
  SNOW: [71, 73, 75, 77, 85, 86],
  THUNDER: [95, 96, 99],
};

const inSet = (code: number, s: number[]) => s.includes(code);

export default function WeatherIcons({ code, isDay = true, size = 40, className = "", title }: Props) {
  const common = { size, weight: "fill" as const, className };
  const label = title ?? `Weather code ${code} (${isDay ? "day" : "night"})`;

  if (inSet(code, WMO.CLEAR)) {
    return isDay ? (
      <Sun {...common} aria-label={label} className={`${className} icon-spin-slow`} />
    ) : (
      <Moon {...common} aria-label={label} className={`${className} icon-bob`} />
    );
  }
  if (inSet(code, WMO.MAINLY_CLEAR)) {
    return isDay ? (
      <CloudSun {...common} aria-label={label} className={`${className} icon-float`} />
    ) : (
      <CloudMoon {...common} aria-label={label} className={`${className} icon-float`} />
    );
  }
  if (inSet(code, WMO.PARTLY_CLOUDY)) {
    return isDay ? (
      <CloudSun {...common} aria-label={label} className={`${className} icon-float`} />
    ) : (
      <CloudMoon {...common} aria-label={label} className={`${className} icon-float`} />
    );
  }
  if (inSet(code, WMO.OVERCAST)) {
    return <Cloud {...common} aria-label={label} className={`${className} icon-float`} />;
  }
  if (inSet(code, WMO.FOG)) {
    return <CloudFog {...common} aria-label={label} className={`${className} icon-float`} />;
  }
  if (inSet(code, WMO.DRIZZLE) || inSet(code, WMO.RAIN)) {
    return <CloudRain {...common} aria-label={label} className={`${className} icon-drip`} />;
  }
  if (inSet(code, WMO.SNOW)) {
    return <CloudSnow {...common} aria-label={label} className={`${className} icon-snow`} />;
  }
  if (inSet(code, WMO.THUNDER)) {
    return <CloudLightning {...common} aria-label={label} className={`${className} icon-pulse`} />;
  }
  return <Cloud {...common} aria-label={label} />;
}
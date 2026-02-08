import {
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  Layers,
  Link2,
  CircleOff,
  Lightbulb,
  Trophy,
  Target,
  FileQuestion,
  ClipboardCheck,
  FileText,
  Crosshair,
  LucideIcon,
} from "lucide-react";

// Map icon names to Lucide components
export const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  Layers,
  Link2,
  CircleOff,
  Lightbulb,
  Trophy,
  Target,
  FileQuestion,
  ClipboardCheck,
  FileText,
  Crosshair,
};

export const getGameIcon = (iconName: string): LucideIcon => {
  return iconMap[iconName] || BookOpen;
};

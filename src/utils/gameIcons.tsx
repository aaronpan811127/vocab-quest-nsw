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
};

export const getGameIcon = (iconName: string): LucideIcon => {
  return iconMap[iconName] || BookOpen;
};

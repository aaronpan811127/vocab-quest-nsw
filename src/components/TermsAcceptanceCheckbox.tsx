import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

interface TermsAcceptanceCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const TermsAcceptanceCheckbox = ({ checked, onCheckedChange, disabled }: TermsAcceptanceCheckboxProps) => {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id="terms-acceptance"
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(val === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <Label htmlFor="terms-acceptance" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
        I agree to the{" "}
        <Link to="/terms?tab=website" target="_blank" className="text-primary hover:underline">
          Website T&C
        </Link>
        ,{" "}
        <Link to="/terms?tab=subscription" target="_blank" className="text-primary hover:underline">
          Subscription T&C
        </Link>
        {" "}and{" "}
        <Link to="/terms?tab=privacy" target="_blank" className="text-primary hover:underline">
          Privacy Policy
        </Link>
      </Label>
    </div>
  );
};

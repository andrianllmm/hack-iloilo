import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import { getStaff } from "@/modules/accounts/auth";
import { buyingBudget } from "../queries";
import { BudgetForm } from "./budget-form";

/**
 * Working capital used and remaining against the manager's buying budget.
 * Renders nothing for encoders (costs are manager-only) without redirecting
 * them off the shared buying page, as `RoleGate` would.
 */
export async function BudgetCard() {
  const staff = await getStaff();
  if (staff?.role !== "manager") return null;

  const budget = await buyingBudget();
  const over = budget.remainingMinor < 0;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Buying budget</CardTitle>
        <CardDescription>
          {budget.start
            ? `Purchases since ${formatDate(budget.start)}.`
            : "All purchases. Set a start date to begin a period."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Budget</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(budget.budgetMinor)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Used</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(budget.usedMinor)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {over ? "Over" : "Remaining"}
            </dt>
            <dd
              className={cn(
                "font-medium tabular-nums",
                over && "text-destructive",
              )}
            >
              {formatMoney(Math.abs(budget.remainingMinor))}
            </dd>
          </div>
        </dl>
        <BudgetForm
          // Remount after a save so inputs show the stored values.
          key={`${budget.budgetMinor}-${budget.start}`}
          budget={(budget.budgetMinor / 100).toFixed(2)}
          start={budget.start ?? ""}
        />
      </CardContent>
    </Card>
  );
}

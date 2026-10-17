from typing import List, Dict, Tuple
from app.schemas.schemas import MemberBalance, DebtTransaction

class DebtSimplifier:
    """
    Financial debt settlement and balance engine.
    Calculates member net balances and finds the minimum number of transactions
    needed to settle all mutual debts within an event.
    """

    @staticmethod
    def calculate_balances(
        members: List[dict],
        expenses: List[dict],
        settlements: List[dict],
        currency: str = "EUR"
    ) -> Tuple[List[MemberBalance], List[DebtTransaction], float]:
        # member_id -> { paid: float, owes: float, name: str, role: str }
        ledger: Dict[str, Dict[str, any]] = {}
        for m in members:
            mid = m["id"]
            ledger[mid] = {
                "paid": 0.0,
                "owes": 0.0,
                "name": m.get("display_title", "Participant"),
                "role": m.get("role", "member")
            }

        total_spent = 0.0

        # 1. Process expenses
        for exp in expenses:
            payer_id = exp["payer_id"]
            amount = float(exp["amount"])
            total_spent += amount
            if payer_id in ledger:
                ledger[payer_id]["paid"] += amount

            splits = exp.get("splits", [])
            if splits:
                for sp in splits:
                    mid = sp["member_id"]
                    sp_amt = float(sp["amount"])
                    if mid in ledger:
                        ledger[mid]["owes"] += sp_amt
            else:
                # If no explicit split rows, split equally among all members
                n = max(1, len(members))
                each = round(amount / n, 2)
                for mid in ledger:
                    ledger[mid]["owes"] += each

        # 2. Process settlements (reimbursements already made)
        for st in settlements:
            from_id = st["from_member_id"]
            to_id = st["to_member_id"]
            amt = float(st["amount"])
            # 'from_id' paid money to 'to_id', so 'from_id' gets credit (owes less or paid more)
            if from_id in ledger:
                ledger[from_id]["paid"] += amt
            if to_id in ledger:
                ledger[to_id]["owes"] += amt

        # 3. Calculate net balances
        member_balances: List[MemberBalance] = []
        debtors: List[List[any]] = []   # [member_id, name, amount_owed]
        creditors: List[List[any]] = [] # [member_id, name, amount_credited]

        for mid, data in ledger.items():
            paid = round(data["paid"], 2)
            owes = round(data["owes"], 2)
            net = round(paid - owes, 2)

            member_balances.append(
                MemberBalance(
                    member_id=mid,
                    display_name=data["name"],
                    role=data["role"],
                    paid_total=paid,
                    owes_total=owes,
                    net_balance=net
                )
            )

            if net < -0.01:
                debtors.append([mid, data["name"], -net])
            elif net > 0.01:
                creditors.append([mid, data["name"], net])

        # 4. Greedy Debt Simplification Algorithm
        suggested_settlements: List[DebtTransaction] = []
        debtors.sort(key=lambda x: x[2], reverse=True)
        creditors.sort(key=lambda x: x[2], reverse=True)

        d_idx = 0
        c_idx = 0

        while d_idx < len(debtors) and c_idx < len(creditors):
            deb_id, deb_name, deb_amt = debtors[d_idx]
            cred_id, cred_name, cred_amt = creditors[c_idx]

            transfer = round(min(deb_amt, cred_amt), 2)
            if transfer > 0.009:
                suggested_settlements.append(
                    DebtTransaction(
                        from_member_id=deb_id,
                        from_member_name=deb_name,
                        to_member_id=cred_id,
                        to_member_name=cred_name,
                        amount=transfer,
                        currency=currency
                    )
                )

            debtors[d_idx][2] = round(deb_amt - transfer, 2)
            creditors[c_idx][2] = round(cred_amt - transfer, 2)

            if debtors[d_idx][2] <= 0.01:
                d_idx += 1
            if creditors[c_idx][2] <= 0.01:
                c_idx += 1

        return member_balances, suggested_settlements, round(total_spent, 2)

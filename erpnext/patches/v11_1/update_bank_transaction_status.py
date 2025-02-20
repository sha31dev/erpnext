# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

import frappe

def execute():
    frappe.reload_doc("accounts", "doctype", "bank_transaction")

    frappe.db.sql(""" UPDATE `tabBank Transaction`
        SET status = 'Reconciled'
        WHERE
            status = 'Settled' and (debit = allocated_amount or credit = allocated_amount)
            and ifnull(allocated_amount, 0) > 0
    """)
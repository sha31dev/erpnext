# Copyright (c) 2019, Web Notes Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

import frappe

def execute():
	from erpnext.stock.stock_balance import update_bin_qty, get_indented_qty

	count=0
	for item_code, warehouse in frappe.db.sql("""select distinct item_code, warehouse
		from `tabMaterial Request Item` where docstatus = 1 and stock_uom<>uom"""):
			try:
				count += 1
				update_bin_qty(item_code, warehouse, {
					"indented_qty": get_indented_qty(item_code, warehouse),
				})
				if count % 200 == 0:
					frappe.db.commit()
			except:
				frappe.db.rollback()

# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

# For license information, please see license.txt

import frappe

from frappe.model.document import Document


class BuyingSettings(Document):
	def validate(self):
		default_fields = [
			"supplier_group", "supp_master_name",
			"maintain_same_rate", "buying_price_list",
			"default_subcontracting_supplier_warehouse"
		]
		for key in default_fields:
			frappe.db.set_default(key, self.get(key, ""))

		from erpnext.setup.doctype.naming_series.naming_series import set_by_naming_series
		set_by_naming_series("Supplier", "supplier_name",
			self.get("supp_master_name") == "Naming Series", hide_name_field=False)

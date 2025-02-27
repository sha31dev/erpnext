# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PackingSlipItem(Document):
	pass


def on_doctype_update():
	frappe.db.add_index("Packing Slip Item", ["item_code", "source_warehouse"])

# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

import frappe

from frappe.model.document import Document

from erpnext.controllers.print_settings import print_settings_for_item_table

class SupplierQuotationItem(Document):
	def __setup__(self):
		print_settings_for_item_table(self)

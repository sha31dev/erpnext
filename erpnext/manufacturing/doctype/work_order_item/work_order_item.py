# -*- coding: utf-8 -*-
# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import cint
from frappe.model.document import Document


class WorkOrderItem(Document):
	@property
	def has_alternative_item(self):
		from erpnext.stock.doctype.item_alternative.item_alternative import has_alternative_item
		return cint(has_alternative_item(self.item_code))


def on_doctype_update():
	frappe.db.add_index("Work Order Item", ["item_code", "source_warehouse"])

# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

import frappe
from frappe.utils import flt, nowdate
import frappe.defaults
from frappe.model.document import Document


class Bin(Document):
	def before_save(self):
		if self.get("__islocal") or not self.stock_uom:
			self.stock_uom = frappe.get_cached_value('Item', self.item_code, 'stock_uom')
		self.set_projected_qty()

	def update_stock(self, args, allow_negative_stock=False, via_landed_cost_voucher=False):
		'''Called from erpnext.stock.utils.update_bin'''
		self.update_qty(args)

		if args.get("actual_qty") or args.get("voucher_type") == "Stock Reconciliation":
			from erpnext.stock.stock_ledger import update_entries_after

			if not args.get("posting_date"):
				args["posting_date"] = nowdate()

			# update valuation and qty after transaction for post dated entry
			if args.get("is_cancelled") == "Yes" and via_landed_cost_voucher:
				return
			update_entries_after({
				"item_code": self.item_code,
				"warehouse": self.warehouse,
				"batch_no": args.get("batch_no"),
				"posting_date": args.get("posting_date"),
				"posting_time": args.get("posting_time"),
				"creation": args.get("creation"),
				"sle_id": args.get("sle_id"),
				"voucher_no": args.get("voucher_no")
			}, allow_negative_stock=allow_negative_stock, via_landed_cost_voucher=via_landed_cost_voucher)

	def update_qty(self, args):
		# update the stock values (for current quantities)
		if args.get("voucher_type")=="Stock Reconciliation":
			if args.get('is_cancelled') == 'No':
				self.actual_qty = args.get("qty_after_transaction")
		else:
			self.actual_qty = flt(self.actual_qty) + flt(args.get("actual_qty"))

		self.ordered_qty = flt(self.ordered_qty) + flt(args.get("ordered_qty"))
		self.reserved_qty = flt(self.reserved_qty) + flt(args.get("reserved_qty"))
		self.indented_qty = flt(self.indented_qty) + flt(args.get("indented_qty"))
		self.planned_qty = flt(self.planned_qty) + flt(args.get("planned_qty"))

		self.set_projected_qty()
		self.db_update()

	def set_projected_qty(self):
		self.projected_qty = (flt(self.actual_qty) + flt(self.ordered_qty)
			+ flt(self.indented_qty) + flt(self.planned_qty) - flt(self.reserved_qty)
			- flt(self.reserved_qty_for_production) - flt(self.reserved_qty_for_sub_contract))

	def get_first_sle(self):
		sle = frappe.db.sql("""
			select * from `tabStock Ledger Entry`
			where item_code = %s
			and warehouse = %s
			order by timestamp(posting_date, posting_time) asc, creation asc
			limit 1
		""", (self.item_code, self.warehouse), as_dict=1)
		return sle and sle[0] or None

	def update_reserved_qty_for_production(self):
		'''Update qty reserved for production from Production Item tables
			in open work orders'''
		self.reserved_qty_for_production = get_reserved_qty_for_production(self.item_code, self.warehouse)

		self.set_projected_qty()

		self.db_set('reserved_qty_for_production', flt(self.reserved_qty_for_production))
		self.db_set('projected_qty', self.projected_qty)

	def update_reserved_qty_for_sub_contracting(self):
		#reserved qty
		reserved_qty_for_sub_contract = frappe.db.sql('''
			select ifnull(sum(itemsup.required_qty), 0)
			from `tabPurchase Order` po, `tabPurchase Order Item Supplied` itemsup
			where
				itemsup.rm_item_code = %s
				and itemsup.parent = po.name
				and po.docstatus = 1
				and po.is_subcontracted = 1
				and po.status != 'Closed'
				and po.receipt_status = 'To Receive'
				and itemsup.reserve_warehouse = %s''', (self.item_code, self.warehouse))[0][0]

		#Get Transferred Entries
		materials_transferred = frappe.db.sql("""
			select
				ifnull(sum(sed.stock_qty), 0)
			from
				`tabStock Entry` se, `tabStock Entry Detail` sed, `tabPurchase Order` po
			where
				se.docstatus=1
				and se.purpose='Send to Subcontractor'
				and ifnull(se.purchase_order, '') != ''
				and (sed.item_code = %(item)s or sed.original_item = %(item)s)
				and se.name = sed.parent
				and se.purchase_order = po.name
				and po.docstatus = 1
				and po.is_subcontracted = 1
				and po.status != 'Closed'
				and po.receipt_status = 'To Receive'
		""", {'item': self.item_code})[0][0]

		if reserved_qty_for_sub_contract > materials_transferred:
			reserved_qty_for_sub_contract = reserved_qty_for_sub_contract - materials_transferred
		else:
			reserved_qty_for_sub_contract = 0

		self.db_set('reserved_qty_for_sub_contract', reserved_qty_for_sub_contract)
		self.set_projected_qty()
		self.db_set('projected_qty', self.projected_qty)


def get_reserved_qty_for_production(item_code, warehouse, work_order=None):
	work_order_condition = ""
	if work_order:
		work_order_condition = " and pro.name = %(work_order)s"

	return flt(frappe.db.sql('''
		SELECT
			IF(pro.skip_transfer = 1 or item.skip_transfer_for_manufacture = 1,
				SUM((item.required_qty - item.consumed_qty) * item.conversion_factor),
				SUM((item.required_qty - item.transferred_qty) * item.conversion_factor)
			)
		FROM `tabWork Order` pro, `tabWork Order Item` item
		WHERE
			item.item_code = %(item_code)s
			and item.parent = pro.name
			and pro.docstatus = 1
			and item.source_warehouse = %(warehouse)s
			and pro.status not in ('Stopped', 'Completed')
			and (
				((pro.skip_transfer = 0 and item.skip_transfer_for_manufacture = 0) and item.required_qty > item.transferred_qty)
				or ((pro.skip_transfer = 1 or item.skip_transfer_for_manufacture = 1) and item.required_qty > item.consumed_qty)
			)
			{0}
	'''.format(work_order_condition), {
		'item_code': item_code, 'warehouse': warehouse, 'work_order': work_order
	})[0][0])


def on_doctype_update():
	frappe.db.add_index("Bin", ["item_code", "warehouse"])

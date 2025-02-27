# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from erpnext.selling.report.sales_details.sales_details import SalesPurchaseDetailsReport


def execute(filters=None):
	return SalesPurchaseDetailsReport(filters).run()

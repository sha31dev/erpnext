// Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Project Template', {
	onload: function(frm) {
		frm.events.setup_queries(frm);
	},

	setup_queries: function (frm) {
		frm.set_query("applicable_item_code", "applicable_items", function (doc, cdt, cdn) {
			return erpnext.queries.item();
		});

		frm.set_query("applicable_uom", "applicable_items", function(doc, cdt, cdn) {
			let item = frappe.get_doc(cdt, cdn);
			return erpnext.queries.item_uom(item.applicable_item_code);
		});

		frm.set_query("next_project_template", function (doc) {
			let filters = {};
			if (frm.doc.applies_to_item) {
				filters["applies_to_item"] = frm.doc.applies_to_item;
			}

			return {
				query: "erpnext.controllers.queries.project_template_query",
				filters: filters
			};
		});
	},

	applies_to_item: function (frm, cdt, cdn) {
		var row = frappe.get_doc(cdt, cdn);
		if (!row.applies_to_item) {
			frappe.model.set_value(cdt, cdn, 'applies_to_item_name', null);
		}
	},
});

frappe.ui.form.on('Project Template Item', {
	applicable_item_code: function (frm, cdt, cdn) {
		var row = frappe.get_doc(cdt, cdn);
		if (!row.applicable_item_code) {
			frappe.model.set_value(cdt, cdn, 'applicable_item_name', null);
		}
	},
});

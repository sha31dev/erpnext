// Copyright (c) 2020, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.provide("erpnext.vehicles");

erpnext.vehicles.VehicleBookingOrder = erpnext.vehicles.VehicleBookingController.extend({
	setup: function () {
		this.frm.custom_make_buttons = {
			'Vehicle Booking Payment': 'Customer Payment',
			'Vehicle Receipt': 'Receive Vehicle',
			'Vehicle Delivery': 'Deliver Vehicle',
			'Vehicle Invoice Receipt': 'Receive Invoice',
			'Vehicle Invoice Delivery': 'Deliver Invoice',
			'Vehicle Transfer Letter': 'Transfer Letter',
			'Purchase Order': 'Purchase Order',
		}
	},

	refresh: function () {
		this._super();
		this.set_customer_is_company_label();
		this.set_dynamic_link();
		this.set_finance_type_mandatory();
		this.setup_notification();
		this.add_create_buttons();
		this.setup_dashboard();
	},

	add_create_buttons: function () {
		// Customer Payment Button (allowed on draft too)
		if (this.frm.doc.docstatus < 2) {
			if (flt(this.frm.doc.customer_outstanding) > 0) {
				this.frm.add_custom_button(__('Customer Payment'),
					() => this.make_payment_entry(this.frm.doc.customer_is_company ? 'Company' : 'Customer'), __('Payment'));
			}
		}

		if (this.frm.doc.docstatus === 1) {
			var unpaid = flt(this.frm.doc.customer_outstanding) > 0 || flt(this.frm.doc.supplier_outstanding) > 0;

			// Supplier Payment Button
			if (flt(this.frm.doc.supplier_outstanding) > 0) {
				this.frm.add_custom_button(__('Supplier Payment'), () => this.make_payment_entry('Supplier'), __('Payment'));
			}

			// Receive/Deliver Vehicle and Invoice
			if (this.frm.doc.vehicle) {
				if (this.frm.doc.delivery_status === "To Receive") {
					if (this.can_change('vehicle_receipt')) {
						this.frm.add_custom_button(__('Receive Vehicle'), () => this.make_next_document('Vehicle Receipt'));
					}
				} else if (this.frm.doc.delivery_status === "To Deliver") {
					if (this.can_change('vehicle_delivery')) {
						this.frm.add_custom_button(__('Deliver Vehicle'), () => this.make_next_document('Vehicle Delivery'));
					}
				} else if (this.frm.doc.delivery_status === "Delivered" && !this.frm.doc.transfer_customer) {
					if (this.can_change('vehicle_transfer')) {
						this.frm.add_custom_button(__('Transfer Letter'), () => this.make_next_document('Vehicle Transfer Letter'));
					}
				}

				if (this.frm.doc.invoice_status === "To Receive") {
					if (this.can_change('invoice_receipt')) {
						this.frm.add_custom_button(__('Receive Invoice'), () => this.make_next_document('Vehicle Invoice Receipt'));
					}
				} else if (this.frm.doc.invoice_status === "To Deliver" && this.frm.doc.delivery_status === "Delivered") {
					if (this.can_change('invoice_delivery')) {
						this.frm.add_custom_button(__('Deliver Invoice'), () => this.make_next_document('Vehicle Invoice Delivery'));
					}
				}
			}

			// Change / Select labels
			var select_vehicle_label = this.frm.doc.vehicle ? "Change Vehicle" : "Select Vehicle";
			var select_allocation_label = this.frm.doc.vehicle_allocation ? "Change Vehicle Allocation" : "Select Allocation";
			var select_delivery_period_label = this.frm.doc.delivery_period ? "Change Delivery Period" : "Select Delivery Period";
			var change_priority_label = cint(this.frm.doc.priority) ? "Mark as Normal Priority" : "Mark as High Priority";

			// Change Buttons
			if (this.can_change('customer_details')) {
				this.frm.add_custom_button(__("Update Customer Details"), () => this.change_customer_details(),
					__("Change"));
			}

			if (this.can_change('allocation')) {
				this.frm.add_custom_button(__(select_allocation_label), () => this.change_allocation(),
					this.frm.doc.vehicle_allocation ? __("Change") : null);
			}

			if (this.can_change('delivery_period')) {
				this.frm.add_custom_button(__(select_delivery_period_label), () => this.change_delivery_period(),
					this.frm.doc.delivery_period ? __("Change") : null);
			}

			if (this.can_change('color')) {
				this.frm.add_custom_button(__("Change Vehicle Color"), () => this.change_color(),
					__("Change"));
			}

			if (this.can_change('vehicle')) {
				this.frm.add_custom_button(__(select_vehicle_label), () => this.change_vehicle(),
					this.frm.doc.vehicle ? __("Change") : null);
			}

			if (this.can_change('payment_adjustment')) {
				this.frm.add_custom_button(__("Change Payment Adjustment"), () => this.change_payment_adjustment(),
					__("Change"));
			}

			if (this.can_change('priority')) {
				this.frm.add_custom_button(__(change_priority_label), () => this.change_priority(),
					__("Change"));
			}

			if (this.can_change('item')) {
				this.frm.add_custom_button(__("Change Vehicle Item (Variant)"), () => this.change_item(),
					__("Change"));
			}

			if (this.frm.doc.vehicle_allocation_required && !this.frm.doc.vehicle_allocation) {
				this.frm.custom_buttons[__(select_allocation_label)] && this.frm.custom_buttons[__(select_allocation_label)].addClass('btn-primary');
			}

			if (unpaid) {
				this.frm.page.set_inner_btn_group_as_primary(__('Payment'));
			} else if (this.frm.doc.status === "To Assign Vehicle") {
				this.frm.custom_buttons[__(select_vehicle_label)] && this.frm.custom_buttons[__(select_vehicle_label)].addClass('btn-primary');
			} else if (this.frm.doc.status === "To Receive Vehicle") {
				this.frm.custom_buttons[__('Receive Vehicle')] && this.frm.custom_buttons[__('Receive Vehicle')].addClass('btn-primary');
			} else if (this.frm.doc.status === "To Receive Invoice") {
				this.frm.custom_buttons[__('Receive Invoice')] && this.frm.custom_buttons[__('Receive Invoice')].addClass('btn-primary');
			} else if (this.frm.doc.status === "To Deliver Vehicle") {
				this.frm.custom_buttons[__('Deliver Vehicle')] && this.frm.custom_buttons[__('Deliver Vehicle')].addClass('btn-primary');
			} else if (this.frm.doc.status === "To Deliver Invoice") {
				this.frm.custom_buttons[__('Deliver Invoice')] && this.frm.custom_buttons[__('Deliver Invoice')].addClass('btn-primary');
			}
		}
	},

	setup_dashboard: function() {
		if (this.frm.doc.docstatus !== 1) {
			return;
		}

		var me = this;
		var company_currency = erpnext.get_currency(me.frm.doc.company);

		me.frm.dashboard.stats_area.removeClass('hidden');
		me.frm.dashboard.stats_area_row.addClass('flex');
		me.frm.dashboard.stats_area_row.css('flex-wrap', 'wrap');

		// Payment Status
		var customer_outstanding_color = me.frm.doc.customer_outstanding ? "orange" : "green";

		var supplier_outstanding_color;
		if (!me.frm.doc.supplier_outstanding) {
			supplier_outstanding_color = "green";
		} else if (me.frm.doc.supplier_outstanding == me.frm.doc.customer_outstanding) {
			supplier_outstanding_color = "blue";
		} else {
			supplier_outstanding_color = "orange";
		}

		var payment_adjustment_color;
		if (!me.frm.doc.payment_adjustment) {
			payment_adjustment_color = 'grey';
		} else if (me.frm.doc.payment_adjustment > 0) {
			payment_adjustment_color = 'blue';
		} else {
			payment_adjustment_color = 'orange';
		}

		me.add_indicator_section(__("Payment"), [
			{
				contents: __('Invoice Total: {0}', [format_currency(me.frm.doc.invoice_total, company_currency)]),
				indicator: 'blue'
			},
			{
				contents: __('Payment Adjustment: {0}', [format_currency(me.frm.doc.payment_adjustment, company_currency)]),
				indicator: payment_adjustment_color
			},
			{
				contents: __('Customer Outstanding: {0}', [format_currency(me.frm.doc.customer_outstanding, company_currency)]),
				indicator: customer_outstanding_color
			},
			{
				contents: __('Supplier Outstanding: {0}', [format_currency(me.frm.doc.supplier_outstanding, company_currency)]),
				indicator: supplier_outstanding_color
			},
		]);

		// Fulfilment Status
		var delivery_status_color;
		if (me.frm.doc.delivery_status == "To Receive") {
			delivery_status_color = "blue";
		} else if (me.frm.doc.delivery_status == "To Deliver") {
			delivery_status_color = "orange";
		} else if (me.frm.doc.delivery_status == "Delivered") {
			delivery_status_color = "green";
		}

		var invoice_status_color;
		if (me.frm.doc.invoice_status == "To Receive") {
			invoice_status_color = "blue";
		} else if (me.frm.doc.invoice_status == "To Deliver") {
			invoice_status_color = "orange";
		} else if (me.frm.doc.invoice_status == "Delivered") {
			invoice_status_color = "green";
		}

		me.add_indicator_section(__("Fulfilment"), [
			{
				contents: __('Priority: {0}', [cint(me.frm.doc.priority) ? 'High' : 'Normal']),
				indicator: cint(me.frm.doc.priority) ? 'red' : 'blue'
			},
			{
				contents: __('Delivery Status: {0}', [me.frm.doc.delivery_status]),
				indicator: delivery_status_color
			},
			{
				contents: __('Invoice Status: {0}', [me.frm.doc.invoice_status]),
				indicator: invoice_status_color
			},
		]);

		// Notification Status
		var booking_confirmation_count = me.get_notification_count('Booking Confirmation', 'SMS');
		var booking_confirmation_color = booking_confirmation_count ? "green" : this.frm.doc.delivery_status == "To Receive" ? "yellow" : "grey";
		var booking_confirmation_status = booking_confirmation_count ? __("{0} SMS", [booking_confirmation_count])
			: __("Not Sent");

		var balance_payment_count = me.get_notification_count('Balance Payment Request', 'SMS');
		var balance_payment_color = balance_payment_count ? "green" : this.frm.doc.customer_outstanding ? "yellow" : "grey";
		var balance_payment_status = balance_payment_count ? __("{0} SMS", [balance_payment_count])
			: __("Not Sent");

		var ready_for_delivery_count = me.get_notification_count('Ready For Delivery', 'SMS');
		var ready_for_delivery_color = ready_for_delivery_count ? "green" : this.frm.doc.delivery_status == "To Deliver" ? "yellow" : "grey";
		var ready_for_delivery_status = ready_for_delivery_count ? __("{0} SMS", [ready_for_delivery_count])
			: __("Not Sent");

		var congratulations_count = me.get_notification_count('Congratulations', 'SMS');
		var congratulations_color = congratulations_count ? "green" : this.frm.doc.invoice_status == "Delivered" ? "yellow" : "grey";
		var congratulations_status = congratulations_count ? __("{0} SMS", [congratulations_count])
			: __("Not Sent");

		me.add_indicator_section(__("Notification"), [
			{
				contents: __('Booking Confirmation: {0}', [booking_confirmation_status]),
				indicator: booking_confirmation_color
			},
			{
				contents: __('Balance Payment Request: {0}', [balance_payment_status]),
				indicator: balance_payment_color
			},
			{
				contents: __('Ready For Delivery: {0}', [ready_for_delivery_status]),
				indicator: ready_for_delivery_color
			},
			{
				contents: __('Congratulations: {0}', [congratulations_status]),
				indicator: congratulations_color
			},
		]);
	},

	add_indicator_section: function (title, items) {
		var items_html = '';
		$.each(items || [], function (i, d) {
			items_html += `<div class="badge-link small">
				<span class="indicator ${d.indicator}">${d.contents}</span>
			</div>`
		});

		var html = $(`<div class="flex-column col-sm-4 col-md-4">
			<div><h6>${title}</h6></div>
			${items_html}
		</div>`);

		html.appendTo(this.frm.dashboard.stats_area_row);

		return html
	},

	setup_notification: function() {
		var me = this;
		if(this.frm.doc.docstatus === 1) {
			if (this.frm.doc.delivery_status == "To Receive") {
				var booking_confirmation_count = this.get_notification_count('Booking Confirmation', 'SMS');
				let label = __("Booking Confirmation{0}", [booking_confirmation_count ? " (Resend)" : ""]);
				this.frm.add_custom_button(label, () => this.send_sms('Booking Confirmation'),
					__("Notify"));
			}

			if (this.frm.doc.customer_outstanding) {
				var balance_payment_count = this.get_notification_count('Balance Payment Request', 'SMS');
				let label = __("Balance Payment Request{0}", [balance_payment_count ? " (Resend)" : ""]);
				this.frm.add_custom_button(label, () => this.send_sms('Balance Payment Request'),
					__("Notify"));
			}

			if (this.frm.doc.delivery_status == "To Deliver") {
				var ready_for_delivery_count = this.get_notification_count('Ready For Delivery', 'SMS');
				let label = __("Ready For Delivery{0}", [ready_for_delivery_count ? " (Resend)" : ""]);
				this.frm.add_custom_button(label, () => this.send_sms('Ready For Delivery'),
					__("Notify"));
			}

			if (this.frm.doc.invoice_status == "Delivered") {
				var congratulations_count = this.get_notification_count('Congratulations', 'SMS');
				let label = __("Congratulations{0}", [congratulations_count ? " (Resend)" : ""]);
				this.frm.add_custom_button(label, () => this.send_sms('Congratulations'),
					__("Notify"));
			}

			this.frm.add_custom_button(__("Custom Message"), () => this.send_sms('Custom Message'),
				__("Notify"));
		}
	},

	send_sms: function(type) {
		var sms_man = new erpnext.SMSManager(this.frm.doc, {
			method: "erpnext.vehicles.doctype.vehicle_booking_order.vehicle_booking_order.send_sms",
			type: type
		});
	},

	company: function () {
		this.set_customer_is_company_label();
		if (this.frm.doc.customer_is_company) {
			this.get_customer_details();
		}
	},

	customer: function () {
		this.get_customer_details();
	},

	financer: function () {
		this.set_finance_type_mandatory();

		if (this.frm.doc.finance_type) {
			this.get_customer_details();
		}

		if (!this.frm.doc.financer) {
			this.frm.set_value("finance_type", "");
		}
	},

	finance_type: function () {
		if (this.frm.doc.finance_type) {
			this.get_customer_details();
		}
	},

	customer_is_company: function () {
		if (this.frm.doc.customer_is_company) {
			this.frm.doc.customer = "";
			this.frm.refresh_field('customer');
			this.frm.set_value("customer_name", this.frm.doc.company);
		} else {
			this.frm.set_value("customer_name", "");
		}

		this.get_customer_details();
	},

	make_payment_entry: function(party_type) {
		if (['Customer', 'Supplier', 'Company'].includes(party_type)) {
			return frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_payment.vehicle_booking_payment.get_payment_entry",
				args: {
					"vehicle_booking_order": this.frm.doc.name,
					"party_type": party_type,
				},
				callback: function (r) {
					var doclist = frappe.model.sync(r.message);
					frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
				}
			});
		}
	},

	make_next_document: function(doctype) {
		if (!doctype)
			return;

		return frappe.call({
			method: "erpnext.vehicles.doctype.vehicle_booking_order.vehicle_booking_order.get_next_document",
			args: {
				"vehicle_booking_order": this.frm.doc.name,
				"doctype": doctype
			},
			callback: function (r) {
				if (!r.exc) {
					var doclist = frappe.model.sync(r.message);
					frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
				}
			}
		});
	},

	change_vehicle: function () {
		var me = this;
		var dialog = new frappe.ui.Dialog({
			title: __("Select Vehicle"),
			fields: [
				{
					label: __("Vehicle"), fieldname: "vehicle", fieldtype: "Link", options: "Vehicle", reqd: 1,
					onchange: () => {
						let vehicle = dialog.get_value('vehicle');
						if (vehicle) {
							frappe.db.get_value("Vehicle", vehicle, ['color', 'chassis_no', 'engine_no', 'warranty_no', 'dispatch_date'], (r) => {
								if (r) {
									dialog.set_values(r);
								}
							});
						}
					}, get_query: () => me.vehicle_query(), get_route_options_for_new_doc: () => me.vehicle_route_options()
				},
				{label: __("Chassis No"), fieldname: "chassis_no", fieldtype: "Data", read_only: 1},
				{label: __("Engine No"), fieldname: "engine_no", fieldtype: "Data", read_only: 1},
				{label: __("Color"), fieldname: "color", fieldtype: "Link", options: "Vehicle Color", read_only: 1},
				{label: __("Warranty Number"), fieldname: "warranty_no", fieldtype: "Data", read_only: 1},
				{label: __("Dispatch Date"), fieldname: "dispatch_date", fieldtype: "Date", read_only: 1},
			]
		});

		dialog.set_primary_action(__("Change"), function () {
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_vehicle",
				args: {
					vehicle_booking_order: me.frm.doc.name,
					vehicle: dialog.get_value('vehicle')
				},
				callback: function (r) {
					if (!r.exc) {
						me.frm.reload_doc();
						dialog.hide();
					}
				}
			});
		});
		dialog.show();
	},

	change_allocation: function () {
		var me = this;

		var call_change_allocation = function (vehicle_allocation) {
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_allocation",
				args: {
					vehicle_booking_order: me.frm.doc.name,
					vehicle_allocation: vehicle_allocation
				},
				callback: function (r) {
					if (!r.exc) {
						me.frm.reload_doc();
						dialog.hide();
					}
				}
			});
		}

		var dialog = new frappe.ui.Dialog({
			title: __("Select Allocation"),
			fields: [
				{
					label: __("Vehicle Allocation"), fieldname: "vehicle_allocation", fieldtype: "Link", options: "Vehicle Allocation", reqd: 1,
					onchange: () => {
						let allocation = dialog.get_value('vehicle_allocation');
						if (allocation) {
							frappe.db.get_value("Vehicle Allocation", allocation, ['title', 'allocation_period', 'delivery_period'], (r) => {
								if (r) {
									dialog.set_values(r);
								}
							});
						}
					}, get_query: () => me.allocation_query(true, dialog), get_route_options_for_new_doc: () => me.allocation_route_options()
				},
				{label: __("Delivery Period"), fieldname: "delivery_period", fieldtype: "Link", options: "Vehicle Allocation Period",
					default: me.frm.doc.delivery_period, bold: 1, get_query: () => me.delivery_period_query(true)},
				{label: __("Allocation Code / Sr #"), fieldname: "title", fieldtype: "Data", read_only: 1},
				{label: __("Allocation Period"), fieldname: "allocation_period", fieldtype: "Link", options: "Vehicle Allocation Period", read_only: 1},
				{label: __("Remove Allocation"), fieldname: "remove_alation", fieldtype: "Button",
					hidden: me.frm.doc.vehicle_allocation ? 0 : 1, click: () => call_change_allocation('')}
			]
		});

		dialog.set_primary_action(__("Change"), function () {
			call_change_allocation(dialog.get_value('vehicle_allocation'));
		});
		dialog.show();
	},

	change_delivery_period: function () {
		var me = this;
		var dialog = new frappe.ui.Dialog({
			title: __("Select Delivery Period"),
			fields: [
				{label: __("Delivery Period"), fieldname: "delivery_period", fieldtype: "Link", options: "Vehicle Allocation Period",
					reqd: 1, get_query: () => me.delivery_period_query(true)}
			]
		});

		dialog.set_primary_action(__("Change"), function () {
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_delivery_period",
				args: {
					vehicle_booking_order: me.frm.doc.name,
					delivery_period: dialog.get_value('delivery_period')
				},
				callback: function (r) {
					if (!r.exc) {
						me.frm.reload_doc();
						dialog.hide();
					}
				}
			});
		});
		dialog.show();
	},

	change_color: function () {
		var me = this;
		var dialog = new frappe.ui.Dialog({
			title: __("Select Color"),
			fields: [
				{label: __("Color (1st Priority)"), fieldname: "color_1", fieldtype: "Link", options: "Vehicle Color", reqd: 1,
					get_query: () => me.color_query()},
				{label: __("Color (2nd Priority)"), fieldname: "color_2", fieldtype: "Link", options: "Vehicle Color",
					get_query: () => me.color_query()},
				{label: __("Color (3rd Priority)"), fieldname: "color_3", fieldtype: "Link", options: "Vehicle Color",
					get_query: () => me.color_query()},
			]
		});

		dialog.set_primary_action(__("Change"), function () {
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_color",
				args: {
					vehicle_booking_order: me.frm.doc.name,
					color_1: dialog.get_value('color_1'),
					color_2: dialog.get_value('color_2'),
					color_3: dialog.get_value('color_3'),
				},
				callback: function (r) {
					if (!r.exc) {
						me.frm.reload_doc();
						dialog.hide();
					}
				}
			});
		});
		dialog.show();
	},

	change_customer_details: function () {
		var me = this;

		var get_customer_details = function (keep_contact) {
			var values = dialog.get_values(true);
			if (values.customer || values.customer_is_company) {
				frappe.call({
					method: "erpnext.vehicles.doctype.vehicle_booking_order.vehicle_booking_order.get_customer_details",
					args: {
						args: {
							company: me.frm.doc.company,
							item_code: me.frm.doc.item_code,
							transaction_date: me.frm.doc.transaction_date,
							customer: values.customer,
							customer_is_company: values.customer_is_company,
							financer: values.financer,
							finance_type: values.finance_type,
							customer_address: keep_contact ? values.customer_address : "",
							contact_person: keep_contact ? values.contact_person : "",
							financer_contact_person: keep_contact ? values.financer_contact_person : "",
						},
						get_withholding_tax: 0
					},
					callback: function (r) {
						if (r.message && !r.exc) {
							dialog.set_values(r.message);
						}
					}
				});
			}
		};

		var get_address_display = function () {
			var values = dialog.get_values(true);
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.vehicle_booking_order.get_address_details",
				args: {
					address: cstr(values.customer_address),
				},
				callback: function (r) {
					if (r.message && !r.exc) {
						dialog.set_values(r.message);
					}
				}
			});
		};

		var get_contact_details = function () {
			var values = dialog.get_values(true);
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.vehicle_booking_order.get_customer_contact_details",
				args: {
					args: {
						customer: values.customer,
						financer: values.financer,
						finance_type: values.finance_type
					},
					customer_contact: values.contact_person,
					financer_contact: values.financer_contact_person
				},
				callback: function (r) {
					if (r.message && !r.exc) {
						dialog.set_values(r.message);
					}
				}
			});
		};

		var dialog = new frappe.ui.Dialog({
			title: __("Update Customer Details"),
			size: 'large',
			fields: [
				{label: __("Customer is {0}", [me.frm.doc.company]), fieldname: "customer_is_company", fieldtype: "Check",
					default: me.frm.doc.customer_is_company, depends_on: "eval:!doc.customer",
					change: () => get_customer_details()
				},

				{label: __("Customer (User)"), fieldname: "customer", fieldtype: "Link", options: "Customer",
					default: me.frm.doc.customer, bold: 1,
					depends_on: "eval:!doc.customer_is_company",
					get_query: () => erpnext.queries.customer(),
					change: () => get_customer_details()
				},

				{label: __("Lessee/User Name"), fieldname: "lessee_name", fieldtype: "Data",
					default: me.frm.doc.lessee_name, read_only: 1},

				{label: __("Customer Name"), fieldname: "customer_name", fieldtype: "Data",
					default: me.frm.doc.customer_name, read_only: 1},

				{fieldtype: 'Column Break'},

				{label: __("Financer"), fieldname: "financer", fieldtype: "Link", options: "Customer",
					default: me.frm.doc.financer,
					get_query: () => erpnext.queries.customer(),
					change: () => get_customer_details()
				},

				{label: __("Financer Name"), fieldname: "financer_name", fieldtype: "Data",
					default: me.frm.doc.financer_name, read_only: 1},

				{label: __("Finance Type"), fieldname: "finance_type", fieldtype: "Select", options: "\nFinanced\nLeased",
					default: me.frm.doc.finance_type,
					depends_on: "financer",
					change: () => get_customer_details()
				},

				{fieldtype: 'Section Break'},

				{label: __("Address"), fieldname: "customer_address", fieldtype: "Link", options: "Address",
					default: me.frm.doc.customer_address,
					get_query: () => {
						var values = dialog.get_values(true);
						me.set_dynamic_link(values);
						return erpnext.queries.address_query(values);
					},
					change: () => get_address_display()
				},

				{fieldtype: 'Column Break'},

				{label: __("Address Display"), fieldname: "address_display", fieldtype: "Small Text",
					default: me.frm.doc.address_display, read_only: 1},

				{fieldtype: 'Section Break'},

				{label: __("Customer Contact Person"), fieldname: "contact_person", fieldtype: "Link", options: "Contact",
					default: me.frm.doc.contact_person,
					get_query: () => {
						var values = dialog.get_values(true);
						me.set_customer_dynamic_link(values);
						return erpnext.queries.contact_query(values);
					},
					change: () => get_contact_details()
				},

				{label: __("Customer Contact Name"), fieldname: "contact_display", fieldtype: "Data",
					default: me.frm.doc.contact_display, read_only: 1},

				{label: __("Financer Contact Person"), fieldname: "financer_contact_person", fieldtype: "Link", options: "Contact",
					default: me.frm.doc.financer_contact_person,
					depends_on: "financer",
					get_query: () => {
						var values = dialog.get_values(true);
						me.set_financer_dynamic_link(values);
						return erpnext.queries.contact_query(values);
					},
					change: () => get_contact_details()
				},

				{label: __("Financer Contact Name"), fieldname: "financer_contact_display", fieldtype: "Data",
					default: me.frm.doc.financer_contact_display, read_only: 1,
					depends_on: "financer"},

				{fieldtype: 'Column Break'},

				{label: __("Contact Email"), fieldname: "contact_email", fieldtype: "Data",
					default: me.frm.doc.contact_email, read_only: 1},

				{label: __("Contact Mobile"), fieldname: "contact_mobile", fieldtype: "Data",
					default: me.frm.doc.contact_mobile, read_only: 1},

				{label: __("Contact Phone"), fieldname: "contact_phone", fieldtype: "Data",
					default: me.frm.doc.contact_phone, read_only: 1},
			]
		});

		dialog.set_primary_action(__("Change/Update"), function () {
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_customer_details",
				args: {
					vehicle_booking_order: me.frm.doc.name,
					customer_is_company: dialog.get_value('customer_is_company'),
					customer: dialog.get_value('customer'),
					financer: dialog.get_value('financer'),
					finance_type: dialog.get_value('finance_type'),
					customer_address: dialog.get_value('customer_address'),
					contact_person: dialog.get_value('contact_person'),
					financer_contact_person: dialog.get_value('financer_contact_person'),
				},
				callback: function (r) {
					if (!r.exc) {
						me.frm.reload_doc();
						dialog.hide();
					}
				}
			});
		});

		get_customer_details(true);
		dialog.show();
	},

	change_item: function () {
		var me = this;

		frappe.db.get_value("Item", me.frm.doc.item_code, 'variant_of', (r) => {
			var variant_of = r.variant_of;
			var item_filters = {"is_vehicle": 1, "include_in_vehicle_booking": 1, "item_code": ['!=', me.frm.doc.item_code]}
			if (variant_of) {
				item_filters['variant_of'] = variant_of;
			}

			var dialog = new frappe.ui.Dialog({
				title: __("Change Vehicle Item (Variant)"),
				fields: [
					{
						label: __("Variant Item Code"), fieldname: "item_code", fieldtype: "Link", options: "Item", reqd: 1,
						onchange: () => {
							let item_code = dialog.get_value('item_code');
							if (item_code) {
								frappe.db.get_value("Item", item_code, 'item_name', (r) => {
									if (r) {
										dialog.set_values(r);
									}
								});
							}
						},
						get_query: () => erpnext.queries.item(item_filters)
					},
					{label: __("Variant Item Name"), fieldname: "item_name", fieldtype: "Data", read_only: 1}
				]
			});

			dialog.set_primary_action(__("Change"), function () {
				frappe.call({
					method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_item",
					args: {
						vehicle_booking_order: me.frm.doc.name,
						item_code: dialog.get_value('item_code')
					},
					callback: function (r) {
						if (!r.exc) {
							me.frm.reload_doc();
							dialog.hide();
						}
					}
				});
			});
			dialog.show();
		});
	},

	change_payment_adjustment: function () {
		var me = this;
		var dialog = new frappe.ui.Dialog({
			title: __("Change Payment Adjustment"),
			fields: [
				{label: __("Payment Adjustment Amount"), fieldname: "payment_adjustment", fieldtype: "Currency",
					options: "Comoany:company:default_currency", reqd: 1,
					description: __(frappe.meta.get_docfield("Vehicle Booking Order", "payment_adjustment").description)},
			]
		});

		dialog.set_primary_action(__("Change"), function () {
			frappe.call({
				method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_payment_adjustment",
				args: {
					vehicle_booking_order: me.frm.doc.name,
					payment_adjustment: dialog.get_value('payment_adjustment')
				},
				callback: function (r) {
					if (!r.exc) {
						me.frm.reload_doc();
						dialog.hide();
					}
				}
			});
		});
		dialog.show();
	},

	change_priority: function () {
		var me = this;

		var new_priority = cint(me.frm.doc.priority) ? 0 : 1;
		var priority_label = new_priority ? "High" : "Normal";

		frappe.confirm(__(`Are you sure you want to change the priority to <b>${__(priority_label)}</b>`),
			function() {
				frappe.call({
					method: "erpnext.vehicles.doctype.vehicle_booking_order.change_booking.change_priority",
					args: {
						vehicle_booking_order: me.frm.doc.name,
						priority: new_priority
					},
					callback: function (r) {
						if (!r.exc) {
							me.frm.reload_doc();
						}
					}
				});
			}
		)
	},

	get_notification_count: function (notification_type, notification_medium) {
		var row = this.frm.doc.notification_count
			.filter(d => d.notification_type === notification_type && d.notification_medium === notification_medium);

		if (row && row.length) {
			return cint(row[0].notification_count);
		} else {
			return 0;
		}
	},

	can_change: function (what) {
		if (this.frm.doc.__onload && this.frm.doc.__onload.can_change) {
			return this.frm.doc.__onload.can_change[what];
		} else {
			return false;
		}
	},
});

$.extend(cur_frm.cscript, new erpnext.vehicles.VehicleBookingOrder({frm: cur_frm}));

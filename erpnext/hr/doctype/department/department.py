# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

import frappe
from frappe.utils.nestedset import NestedSet, get_root_of
from erpnext.utilities.transaction_base import delete_events


class Department(NestedSet):
	nsm_parent_field = 'parent_department'

	def autoname(self):
		root = get_root_of("Department")
		if root and self.department_name != root:
			self.name = get_abbreviated_name(self.department_name, self.company)
		else:
			self.name = self.department_name

	def validate(self):
		if not self.parent_department:
			root = get_root_of("Department")
			if root:
				self.parent_department = root

	def before_rename(self, old, new, merge=False):
		# renaming consistency with abbreviation
		abbr = frappe.get_cached_value('Company',  self.company,  'abbr')

		if not abbr in new:
			new = get_abbreviated_name(new, self.company)

		without_abbr = new[:-3-len(abbr)] if new.endswith(" - {0}".format(abbr)) else new
		frappe.db.set_value("Department", old, "department_name", without_abbr)

		return new

	def on_update(self):
		NestedSet.on_update(self)

	def on_trash(self):
		super(Department, self).on_trash()
		delete_events(self.doctype, self.name)


def on_doctype_update():
	frappe.db.add_index("Department", ["lft", "rgt"])


def get_abbreviated_name(name, company):
	abbr = frappe.get_cached_value('Company',  company,  'abbr')
	new_name = '{0} - {1}'.format(name, abbr)
	return new_name


@frappe.whitelist()
def get_children(doctype, parent=None, company=None, is_root=False):
	condition = ''
	var_dict = {
		"name": get_root_of("Department"),
		"parent": parent,
		"company": company,
	}
	if company == parent:
		condition = "name=%(name)s"
	elif company:
		condition = "parent_department=%(parent)s and company=%(company)s"
	else:
		condition = "parent_department = %(parent)s"

	return frappe.db.sql("""
		select
			name as value,
			is_group as expandable
		from `tab{doctype}`
		where
			{condition}
		order by name""".format(doctype=doctype, condition=condition), var_dict, as_dict=1)


@frappe.whitelist()
def add_node():
	from frappe.desk.treeview import make_tree_args
	args = frappe.form_dict
	args = make_tree_args(**args)

	if args.parent_department == args.company:
		args.parent_department = None

	frappe.get_doc(args).insert()


def get_department_cost_center(department):
	current_department = department
	while current_department:
		current_doc = frappe.get_cached_doc("Department", current_department)
		if current_doc.cost_center:
			return current_doc.cost_center

		current_department = current_doc.parent_department

# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors and Contributors
# See license.txt

import frappe
import unittest
from frappe.utils import nowdate

test_records = frappe.get_test_records('Attendance')

class TestAttendance(unittest.TestCase):
	def test_mark_absent(self):
		from erpnext.hr.doctype.employee.test_employee import make_employee
		employee = make_employee("test_mark_absent@example.com")
		date = nowdate()
		frappe.db.delete('Attendance', {'employee':employee, 'attendance_date':date})
		from erpnext.hr.doctype.attendance.attendance import mark_absent
		attendance = mark_absent(employee, date)
		fetch_attendance = frappe.get_value('Attendance', {'employee':employee, 'attendance_date':date, 'status':'Absent'})
		self.assertEqual(attendance, fetch_attendance)

from frappe import _

def get_data():
     return {
        'fieldname': 'job_applicant',
        'transactions': [
            {
                'items': ['Employee', 'Employee Onboarding']
            },
            {
                'items': ['Job Offer']
            },
        ],
    }
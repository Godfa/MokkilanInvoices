import { describe, it, expect, beforeEach, vi } from 'vitest'
import InvoiceStore from './invoiceStore'
import agent from '../api/agent'
import { Invoice, ExpenseItem, ExpenseLineItem, InvoiceStatus } from '../models/invoice'

// Mock the agent
vi.mock('../api/agent', () => ({
  default: {
    ExpenseLineItems: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('InvoiceStore - Line Items', () => {
  let store: InvoiceStore
  const invoiceId = 'test-invoice-id'
  const expenseItemId = 'test-expense-item-id'

  beforeEach(() => {
    store = new InvoiceStore()
    vi.clearAllMocks()

    // Setup initial state with invoice and expense item
    const invoice: Invoice = {
      id: invoiceId,
      lanNumber: 1,
      title: 'Test Invoice',
      description: 'Test',
      image: '',
      amount: 0,
      expenseItems: [
        {
          id: expenseItemId,
          name: 'Expense Item 1',
          expenseType: 0,
          organizerId: '1',
          organizer: { id: '1', displayName: 'Epi', userName: 'epi', email: '' },
          amount: 0,
          payers: [],
          lineItems: [],
        },
      ],
      participants: [],
      status: InvoiceStatus.Aktiivinen,
      approvals: [],
    }

    store.invoiceRegistry.set(invoiceId, invoice)
    store.selectedInvoice = invoice
  })

  describe('createLineItem', () => {
    it('should create a line item and update invoice registry', async () => {
      const lineItem: ExpenseLineItem = {
        id: 'line-item-1',
        expenseItemId: expenseItemId,
        name: 'Item 1',
        quantity: 2,
        unitPrice: 10.50,
        total: 21.00,
      }

      vi.mocked(agent.ExpenseLineItems.create).mockResolvedValue(undefined)

      await store.createLineItem(invoiceId, expenseItemId, lineItem)

      expect(agent.ExpenseLineItems.create).toHaveBeenCalledWith(expenseItemId, lineItem)

      const updatedInvoice = store.invoiceRegistry.get(invoiceId)
      const expenseItem = updatedInvoice?.expenseItems.find(ei => ei.id === expenseItemId)

      expect(expenseItem?.lineItems).toHaveLength(1)
      expect(expenseItem?.lineItems[0]).toEqual(lineItem)
      expect(store.selectedInvoice?.expenseItems[0].lineItems).toHaveLength(1)
    })

    it('should initialize lineItems array if it does not exist', async () => {
      const invoice = store.invoiceRegistry.get(invoiceId)
      if (invoice) {
        invoice.expenseItems[0].lineItems = undefined as any
      }

      const lineItem: ExpenseLineItem = {
        id: 'line-item-1',
        expenseItemId: expenseItemId,
        name: 'First Item',
        quantity: 1,
        unitPrice: 5.00,
        total: 5.00,
      }

      vi.mocked(agent.ExpenseLineItems.create).mockResolvedValue(undefined)

      await store.createLineItem(invoiceId, expenseItemId, lineItem)

      const updatedInvoice = store.invoiceRegistry.get(invoiceId)
      const expenseItem = updatedInvoice?.expenseItems.find(ei => ei.id === expenseItemId)

      expect(expenseItem?.lineItems).toBeDefined()
      expect(expenseItem?.lineItems).toHaveLength(1)
    })
  })

  describe('updateLineItem', () => {
    beforeEach(() => {
      const invoice = store.invoiceRegistry.get(invoiceId)
      if (invoice) {
        invoice.expenseItems[0].lineItems = [
          {
            id: 'line-item-1',
            expenseItemId: expenseItemId,
            name: 'Original Name',
            quantity: 1,
            unitPrice: 10.00,
            total: 10.00,
          },
        ]
      }
      store.selectedInvoice = invoice
    })

    it('should update a line item in the registry', async () => {
      const updatedLineItem: ExpenseLineItem = {
        id: 'line-item-1',
        expenseItemId: expenseItemId,
        name: 'Updated Name',
        quantity: 5,
        unitPrice: 20.50,
        total: 102.50,
      }

      vi.mocked(agent.ExpenseLineItems.update).mockResolvedValue(undefined)

      await store.updateLineItem(invoiceId, expenseItemId, updatedLineItem)

      expect(agent.ExpenseLineItems.update).toHaveBeenCalledWith(expenseItemId, updatedLineItem)

      const invoice = store.invoiceRegistry.get(invoiceId)
      const expenseItem = invoice?.expenseItems.find(ei => ei.id === expenseItemId)
      const lineItem = expenseItem?.lineItems[0]

      expect(lineItem?.name).toBe('Updated Name')
      expect(lineItem?.quantity).toBe(5)
      expect(lineItem?.unitPrice).toBe(20.50)
      expect(lineItem?.total).toBe(102.50)
    })

    it('should update selectedInvoice when it matches invoiceId', async () => {
      const updatedLineItem: ExpenseLineItem = {
        id: 'line-item-1',
        expenseItemId: expenseItemId,
        name: 'Updated via Selected',
        quantity: 3,
        unitPrice: 15.00,
        total: 45.00,
      }

      vi.mocked(agent.ExpenseLineItems.update).mockResolvedValue(undefined)

      await store.updateLineItem(invoiceId, expenseItemId, updatedLineItem)

      const lineItem = store.selectedInvoice?.expenseItems[0].lineItems[0]
      expect(lineItem?.name).toBe('Updated via Selected')
    })
  })

  describe('deleteLineItem', () => {
    beforeEach(() => {
      const invoice = store.invoiceRegistry.get(invoiceId)
      if (invoice) {
        invoice.expenseItems[0].lineItems = [
          {
            id: 'line-item-1',
            expenseItemId: expenseItemId,
            name: 'Item 1',
            quantity: 1,
            unitPrice: 10.00,
            total: 10.00,
          },
          {
            id: 'line-item-2',
            expenseItemId: expenseItemId,
            name: 'Item 2',
            quantity: 2,
            unitPrice: 15.00,
            total: 30.00,
          },
        ]
      }
      store.selectedInvoice = invoice
    })

    it('should delete a line item from the registry', async () => {
      vi.mocked(agent.ExpenseLineItems.delete).mockResolvedValue(undefined)

      await store.deleteLineItem(invoiceId, expenseItemId, 'line-item-1')

      expect(agent.ExpenseLineItems.delete).toHaveBeenCalledWith(expenseItemId, 'line-item-1')

      const invoice = store.invoiceRegistry.get(invoiceId)
      const expenseItem = invoice?.expenseItems.find(ei => ei.id === expenseItemId)

      expect(expenseItem?.lineItems).toHaveLength(1)
      expect(expenseItem?.lineItems[0].id).toBe('line-item-2')
      expect(expenseItem?.lineItems.find(li => li.id === 'line-item-1')).toBeUndefined()
    })

    it('should update selectedInvoice when deleting', async () => {
      vi.mocked(agent.ExpenseLineItems.delete).mockResolvedValue(undefined)

      await store.deleteLineItem(invoiceId, expenseItemId, 'line-item-2')

      expect(store.selectedInvoice?.expenseItems[0].lineItems).toHaveLength(1)
      expect(store.selectedInvoice?.expenseItems[0].lineItems[0].id).toBe('line-item-1')
    })

    it('should handle deleting the last line item', async () => {
      const invoice = store.invoiceRegistry.get(invoiceId)
      if (invoice) {
        invoice.expenseItems[0].lineItems = [
          {
            id: 'line-item-1',
            expenseItemId: expenseItemId,
            name: 'Only Item',
            quantity: 1,
            unitPrice: 10.00,
            total: 10.00,
          },
        ]
      }

      vi.mocked(agent.ExpenseLineItems.delete).mockResolvedValue(undefined)

      await store.deleteLineItem(invoiceId, expenseItemId, 'line-item-1')

      const expenseItem = invoice?.expenseItems.find(ei => ei.id === expenseItemId)
      expect(expenseItem?.lineItems).toHaveLength(0)
    })
  })

  describe('Line Item Total Calculation', () => {
    it('should calculate total correctly in created line item', async () => {
      const lineItem: ExpenseLineItem = {
        id: 'line-item-1',
        expenseItemId: expenseItemId,
        name: 'Decimal Test',
        quantity: 3,
        unitPrice: 15.99,
        total: 47.97,
      }

      vi.mocked(agent.ExpenseLineItems.create).mockResolvedValue(undefined)

      await store.createLineItem(invoiceId, expenseItemId, lineItem)

      const invoice = store.invoiceRegistry.get(invoiceId)
      const savedItem = invoice?.expenseItems[0].lineItems[0]

      expect(savedItem?.total).toBe(47.97)
    })
  })
})

import type { Product } from '@wos/domain';
import { useState } from 'react';
import type { MoveTaskState, TaskKind } from './mode';

export function useStorageInspectorUiState() {
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [taskKind, setTaskKind] = useState<TaskKind | null>(null);
  const [moveTaskState, setMoveTaskState] = useState<MoveTaskState | null>(null);

  const [createContainerTypeId, setCreateContainerTypeId] = useState('');
  const [createExternalCode, setCreateExternalCode] = useState('');
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [createIsSubmitting, setCreateIsSubmitting] = useState(false);

  const [createWithProductContainerTypeId, setCreateWithProductContainerTypeId] = useState('');
  const [createWithProductExternalCode, setCreateWithProductExternalCode] = useState('');
  const [createWithProductSearch, setCreateWithProductSearch] = useState('');
  const [createWithProductSelectedProduct, setCreateWithProductSelectedProduct] = useState<Product | null>(null);
  const [createWithProductQuantity, setCreateWithProductQuantity] = useState('');
  const [createWithProductUom, setCreateWithProductUom] = useState('');
  const [createWithProductErrorMessage, setCreateWithProductErrorMessage] = useState<string | null>(null);
  const [createWithProductIsSubmitting, setCreateWithProductIsSubmitting] = useState(false);

  const [addProductSearch, setAddProductSearch] = useState('');
  const [addProductSelectedProduct, setAddProductSelectedProduct] = useState<Product | null>(null);
  const [addProductQuantity, setAddProductQuantity] = useState('');
  const [addProductUom, setAddProductUom] = useState('');
  const [addProductErrorMessage, setAddProductErrorMessage] = useState<string | null>(null);
  const [editOverrideIsSubmitting, setEditOverrideIsSubmitting] = useState(false);
  const [editOverrideErrorMessage, setEditOverrideErrorMessage] = useState<string | null>(null);
  const [repairConflictIsSubmitting, setRepairConflictIsSubmitting] = useState(false);
  const [repairConflictErrorMessage, setRepairConflictErrorMessage] = useState<string | null>(null);

  const resetCreateTaskState = () => {
    setCreateContainerTypeId('');
    setCreateExternalCode('');
    setCreateErrorMessage(null);
    setCreateIsSubmitting(false);
  };

  const resetCreateWithProductTaskState = () => {
    setCreateWithProductContainerTypeId('');
    setCreateWithProductExternalCode('');
    setCreateWithProductSearch('');
    setCreateWithProductSelectedProduct(null);
    setCreateWithProductQuantity('');
    setCreateWithProductUom('');
    setCreateWithProductErrorMessage(null);
    setCreateWithProductIsSubmitting(false);
  };

  const resetAddProductTaskState = () => {
    setAddProductSearch('');
    setAddProductSelectedProduct(null);
    setAddProductQuantity('');
    setAddProductUom('');
    setAddProductErrorMessage(null);
  };

  const resetEditOverrideTaskState = () => {
    setEditOverrideIsSubmitting(false);
    setEditOverrideErrorMessage(null);
  };

  const resetRepairConflictTaskState = () => {
    setRepairConflictIsSubmitting(false);
    setRepairConflictErrorMessage(null);
  };

  const closeCreateTask = () => {
    setTaskKind(null);
    resetCreateTaskState();
  };

  const closeCreateWithProductTask = () => {
    setTaskKind(null);
    resetCreateWithProductTaskState();
  };

  const closeAddProductTask = () => {
    setTaskKind(null);
    resetAddProductTaskState();
  };

  const closeEditOverrideTask = () => {
    if (editOverrideIsSubmitting) return;
    setTaskKind(null);
    resetEditOverrideTaskState();
  };

  const closeRepairConflictTask = () => {
    if (repairConflictIsSubmitting) return;
    setTaskKind(null);
    resetRepairConflictTaskState();
  };

  const openCreateTask = () => {
    resetCreateTaskState();
    setTaskKind('create-container');
  };

  const openCreateWithProductTask = () => {
    resetCreateWithProductTaskState();
    setTaskKind('create-container-with-product');
  };

  const openAddProductTask = () => {
    resetAddProductTaskState();
    setTaskKind('add-product-to-container');
  };

  const openRepairConflictTask = () => {
    resetRepairConflictTaskState();
    setTaskKind('repair-conflict');
  };

  const resetAllTransientStateForCellChange = () => {
    setSelectedContainerId(null);
    setTaskKind(null);
    setMoveTaskState(null);
    resetCreateTaskState();
    resetCreateWithProductTaskState();
    resetAddProductTaskState();
    resetEditOverrideTaskState();
    resetRepairConflictTaskState();
  };

  return {
    selectedContainerId,
    setSelectedContainerId,
    taskKind,
    setTaskKind,
    moveTaskState,
    setMoveTaskState,

    createContainerTypeId,
    setCreateContainerTypeId,
    createExternalCode,
    setCreateExternalCode,
    createErrorMessage,
    setCreateErrorMessage,
    createIsSubmitting,
    setCreateIsSubmitting,

    createWithProductContainerTypeId,
    setCreateWithProductContainerTypeId,
    createWithProductExternalCode,
    setCreateWithProductExternalCode,
    createWithProductSearch,
    setCreateWithProductSearch,
    createWithProductSelectedProduct,
    setCreateWithProductSelectedProduct,
    createWithProductQuantity,
    setCreateWithProductQuantity,
    createWithProductUom,
    setCreateWithProductUom,
    createWithProductErrorMessage,
    setCreateWithProductErrorMessage,
    createWithProductIsSubmitting,
    setCreateWithProductIsSubmitting,

    addProductSearch,
    setAddProductSearch,
    addProductSelectedProduct,
    setAddProductSelectedProduct,
    addProductQuantity,
    setAddProductQuantity,
    addProductUom,
    setAddProductUom,
    addProductErrorMessage,
    setAddProductErrorMessage,

    editOverrideIsSubmitting,
    setEditOverrideIsSubmitting,
    editOverrideErrorMessage,
    setEditOverrideErrorMessage,
    repairConflictIsSubmitting,
    setRepairConflictIsSubmitting,
    repairConflictErrorMessage,
    setRepairConflictErrorMessage,

    resetCreateTaskState,
    resetCreateWithProductTaskState,
    resetAddProductTaskState,
    resetEditOverrideTaskState,
    resetRepairConflictTaskState,
    closeCreateTask,
    closeCreateWithProductTask,
    closeAddProductTask,
    closeEditOverrideTask,
    closeRepairConflictTask,
    openCreateTask,
    openCreateWithProductTask,
    openAddProductTask,
    openRepairConflictTask,
    resetAllTransientStateForCellChange
  };
}

export type StorageInspectorUiState = ReturnType<typeof useStorageInspectorUiState>;

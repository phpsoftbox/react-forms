import React from 'react';
import { Input, MarkdownEditor, Stack, Tabs, Text } from '@phpsoftbox/react-softbox';

export type DynamicFormFieldOption = {
  label: string;
  value: string | number;
};

export type DynamicFormFieldCondition = Record<string, unknown>;

export type DynamicFormFieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'email'
  | 'tel'
  | 'password'
  | 'file'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'number'
  | 'date'
  | 'interval'
  | 'hidden';

export type DynamicFormValueType =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'array'
  | 'json'
  | 'date'
  | 'datetime';

export type DynamicFormField = {
  key: string;
  label?: string;
  description?: string;
  required?: boolean;
  field?: DynamicFormFieldType;
  fieldType?: DynamicFormFieldType;
  valueType?: DynamicFormValueType;
  multiple?: boolean;
  searchable?: boolean;
  options?: DynamicFormFieldOption[];
  requiredWhen?: DynamicFormFieldCondition[];
  visibleWhen?: DynamicFormFieldCondition[];
  meta?: Record<string, unknown>;
};

export type DynamicFormSchema = {
  id?: string;
  title?: string;
  fields: DynamicFormField[];
  meta?: Record<string, unknown>;
};

export type DynamicFormValue = string | number | boolean | null | File | Array<string | number | File>;
export type DynamicFormData = Record<string, DynamicFormValue>;

type DynamicFormFieldsProps = {
  schema: DynamicFormSchema;
  data: DynamicFormData;
  errors?: Record<string, unknown>;
  onChange: (key: string, value: DynamicFormValue) => void;
  groupBySection?: boolean;
  sectionLabels?: Record<string, string>;
  sectionClassName?: string;
  sectionTitleClassName?: string;
  fieldClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
};

type NormalizedCondition = { field: string; operator: string; value: unknown };

const normalizeFieldError = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (Array.isArray(error)) {
    const first = error.find((item) => typeof item === 'string');

    return typeof first === 'string' ? first : '';
  }

  return '';
};

export const resolveDynamicFieldType = (field: DynamicFormField): DynamicFormFieldType => {
  const component = typeof field.meta?.component === 'string' ? field.meta.component : '';
  if (component === 'markdown') {
    return 'markdown';
  }

  const widget = typeof field.meta?.widget === 'string' ? field.meta.widget : '';
  if (widget === 'file') {
    return 'file';
  }

  return field.fieldType ?? field.field ?? 'text';
};

export const resolveDynamicFieldOptions = (field: DynamicFormField): DynamicFormFieldOption[] => {
  if (Array.isArray(field.options)) {
    return field.options;
  }

  const metaOptions = field.meta?.options;

  return Array.isArray(metaOptions) ? (metaOptions as DynamicFormFieldOption[]) : [];
};

export const resolveDynamicFieldSection = (field: DynamicFormField): string => {
  const section = field.meta?.section;

  return typeof section === 'string' && section !== '' ? section : 'general';
};

const resolveDynamicFieldTooltip = (field: DynamicFormField): string | undefined => {
  const metaTooltip = field.meta?.tooltip;
  if (typeof metaTooltip === 'string' && metaTooltip.trim() !== '') {
    return metaTooltip.trim();
  }

  const description = typeof field.description === 'string' ? field.description.trim() : '';
  return description !== '' ? description : undefined;
};

const normalizeCondition = (condition: DynamicFormFieldCondition): NormalizedCondition[] => {
  const fieldName = condition.field;
  if (typeof fieldName === 'string' && fieldName !== '') {
    const operator = typeof condition.operator === 'string' && condition.operator !== '' ? condition.operator : '=';

    return [{ field: fieldName, operator, value: condition.value }];
  }

  return Object.entries(condition)
    .filter(([key]) => key !== 'field' && key !== 'operator' && key !== 'value')
    .map(([key, value]) => ({ field: key, operator: '=', value }));
};

const matchesCondition = (condition: DynamicFormFieldCondition, data: DynamicFormData): boolean => {
  const entries = normalizeCondition(condition);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(({ field, operator, value }) => {
    const actual = data[field];

    if (operator === '=') {
      return actual === value;
    }

    if (operator === '!=') {
      return actual !== value;
    }

    if (operator === 'in') {
      return Array.isArray(value) ? value.includes(actual) : false;
    }

    if (operator === 'not_in') {
      return Array.isArray(value) ? !value.includes(actual) : false;
    }

    return false;
  });
};

const conditionsMatch = (conditions: DynamicFormFieldCondition[] | undefined, data: DynamicFormData): boolean => {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return true;
  }

  return conditions.every((condition) => matchesCondition(condition, data));
};

export const isDynamicFieldVisible = (field: DynamicFormField, data: DynamicFormData): boolean => {
  return conditionsMatch(field.visibleWhen, data);
};

export const isDynamicFieldRequired = (field: DynamicFormField, data: DynamicFormData): boolean => {
  const baseRequired = field.required === true || field.meta?.required === true;
  const requiredWhenMatches = Array.isArray(field.requiredWhen) && field.requiredWhen.length > 0
    ? conditionsMatch(field.requiredWhen, data)
    : false;

  return baseRequired || requiredWhenMatches;
};

export const coerceDynamicInitialValue = (field: DynamicFormField, value: unknown): DynamicFormValue => {
  const fieldType = resolveDynamicFieldType(field);

  if (fieldType === 'checkbox' || field.valueType === 'bool') {
    return Boolean(value);
  }

  if (fieldType === 'number' || field.valueType === 'int' || field.valueType === 'float') {
    return value === null || value === undefined ? '' : String(value);
  }

  if (fieldType === 'file') {
    return typeof value === 'string' ? value : null;
  }

  if (fieldType === 'select' && field.multiple) {
    return Array.isArray(value) ? (value as Array<string | number | File>) : [];
  }

  if (fieldType === 'date') {
    return typeof value === 'string' ? value : '';
  }

  return typeof value === 'string' || typeof value === 'number' ? value : '';
};

export const buildDynamicFormData = (schema: DynamicFormSchema, values: Record<string, unknown>): DynamicFormData => {
  const data: DynamicFormData = {};

  schema.fields.forEach((field) => {
    if (typeof field?.key !== 'string' || field.key === '') {
      return;
    }

    data[field.key] = coerceDynamicInitialValue(field, values[field.key]);
  });

  return data;
};

export const isDynamicValueFilled = (value: DynamicFormValue | undefined): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return true;
  }

  if (value instanceof File) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return String(value).trim() !== '';
};

const defaultSectionLabel = (section: string): string => {
  return section === 'general' ? 'Общие данные' : section;
};

export default function DynamicFormFields({
  schema,
  data,
  errors = {},
  onChange,
  groupBySection = false,
  sectionLabels = {},
  sectionClassName,
  sectionTitleClassName,
  fieldClassName,
  labelClassName,
  descriptionClassName,
}: DynamicFormFieldsProps) {
  const visibleFields = React.useMemo(() => {
    return (schema.fields ?? [])
      .filter((field): field is DynamicFormField => typeof field?.key === 'string' && field.key !== '')
      .filter((field) => isDynamicFieldVisible(field, data));
  }, [schema.fields, data]);

  const renderField = (field: DynamicFormField) => {
    const fieldType = resolveDynamicFieldType(field);
    const required = isDynamicFieldRequired(field, data);
    const label = field.label ?? field.key;
    const error = normalizeFieldError(errors[field.key]);
    const hasError = error !== '';
    const tooltip = resolveDynamicFieldTooltip(field);

    if (fieldType === 'hidden') {
      return <input key={field.key} type="hidden" name={field.key} value={String(data[field.key] ?? '')} />;
    }

    if (fieldType === 'file') {
      const currentValue = data[field.key];
      const selectedFiles = Array.isArray(currentValue)
        ? currentValue.filter((value): value is File => value instanceof File)
        : [];
      const selectedFile = currentValue instanceof File ? currentValue : null;
      const currentPath = typeof currentValue === 'string' ? currentValue : '';
      const accept = typeof field.meta?.accept === 'string' ? field.meta.accept : undefined;
      const requiredForInput = required && currentPath === '' && selectedFile === null && selectedFiles.length === 0;

      return (
        <div key={field.key} className={fieldClassName}>
          <Input>
            <Input.Label required={required} hint={tooltip} hintPlacement="auto">{label}</Input.Label>
            <Input.Field
              name={field.key}
              type="file"
              required={requiredForInput}
              multiple={field.multiple === true}
              accept={accept}
              onChange={(event) => {
                const files = event.target.files;
                if (field.multiple) {
                  onChange(field.key, files ? Array.from(files) : []);
                  return;
                }

                onChange(field.key, files?.[0] ?? null);
              }}
            />
            {hasError ? <Input.ErrorTooltip target="input" content={error} placement="auto" /> : null}
          </Input>
          {selectedFile ? <Text className={descriptionClassName}>Выбран файл: {selectedFile.name}</Text> : null}
          {!selectedFile && selectedFiles.length > 0 ? (
            <Text className={descriptionClassName}>Выбрано файлов: {selectedFiles.length}</Text>
          ) : null}
          {currentPath !== '' ? <Text className={descriptionClassName}>Текущий файл: {currentPath}</Text> : null}
        </div>
      );
    }

    if (fieldType === 'checkbox') {
      const widget = typeof field.meta?.widget === 'string' ? field.meta.widget : '';

      return (
        <div key={field.key} className={fieldClassName}>
          {widget === 'checkbox' ? (
            <Input.Checkbox
              name={field.key}
              label={label}
              hint={tooltip}
              hintPlacement="auto"
              checked={Boolean(data[field.key])}
              onChange={(event) => onChange(field.key, event.target.checked)}
            />
          ) : (
            <Input.Switch
              name={field.key}
              label={label}
              checked={Boolean(data[field.key])}
              hint={tooltip}
              hintPlacement="auto"
              onChange={(event) => onChange(field.key, event.target.checked)}
            />
          )}
          {hasError ? <Input.ErrorBag>{error}</Input.ErrorBag> : null}
        </div>
      );
    }

    if (fieldType === 'select') {
      const options = resolveDynamicFieldOptions(field);

      if (field.multiple) {
        const selected = Array.isArray(data[field.key]) ? (data[field.key] as Array<string | number>) : [];

        return (
          <div key={field.key} className={fieldClassName}>
            <Input>
              <Input.FloatLabel label={label} required={required} hasError={hasError} hint={tooltip} hintPlacement="auto">
                <Input.Select
                  name={field.key}
                  options={options}
                  value={selected}
                  multiple
                  searchable={Boolean(field.searchable)}
                  onChange={(value) => onChange(field.key, value as Array<string | number>)}
                />
              </Input.FloatLabel>
              {hasError ? <Input.ErrorTooltip target="input" content={error} placement="auto" /> : null}
            </Input>
          </div>
        );
      }

      const selected = data[field.key];
      const selectedValue = typeof selected === 'string' || typeof selected === 'number'
        ? selected
        : undefined;

      return (
        <div key={field.key} className={fieldClassName}>
          <Input>
            <Input.FloatLabel label={label} required={required} hasError={hasError} hint={tooltip} hintPlacement="auto">
              <Input.Select
                name={field.key}
                options={options}
                value={selectedValue}
                searchable={Boolean(field.searchable)}
                onChange={(value) => onChange(field.key, value as string | number)}
              />
            </Input.FloatLabel>
            {hasError ? <Input.ErrorTooltip target="input" content={error} placement="auto" /> : null}
          </Input>
        </div>
      );
    }

    if (fieldType === 'radio') {
      const options = resolveDynamicFieldOptions(field);

      return (
        <div key={field.key} className={fieldClassName}>
          <Text className={labelClassName}>{label}</Text>
          <Stack gap="8px">
            {options.map((option) => (
              <Input.Radio
                key={`${field.key}-${option.value}`}
                name={field.key}
                label={option.label}
                hint={tooltip}
                hintPlacement="auto"
                checked={data[field.key] === option.value}
                onChange={() => onChange(field.key, option.value)}
              />
            ))}
          </Stack>
          {hasError ? <Input.ErrorBag>{error}</Input.ErrorBag> : null}
        </div>
      );
    }

    if (fieldType === 'textarea') {
      return (
        <div key={field.key} className={fieldClassName}>
          <Input>
            <Input.FloatLabel label={label} required={required} hasError={hasError} hint={tooltip} hintPlacement="auto">
              <Input.TextArea
                name={field.key}
                value={String(data[field.key] ?? '')}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            </Input.FloatLabel>
            {hasError ? <Input.ErrorTooltip target="input" content={error} placement="auto" /> : null}
          </Input>
        </div>
      );
    }

    if (fieldType === 'markdown') {
      const rawValue = data[field.key];
      const value = typeof rawValue === 'string' ? rawValue : '';
      const minHeight = typeof field.meta?.minHeight === 'number' && field.meta.minHeight > 140
        ? field.meta.minHeight
        : 260;

      return (
        <div key={field.key} className={fieldClassName}>
          <Input>
            <Input.Label required={required} hint={tooltip} hintPlacement="auto">{label}</Input.Label>
          </Input>
          <MarkdownEditor
            value={value}
            onChange={(nextValue) => onChange(field.key, nextValue)}
            minHeight={minHeight}
            placeholder="Введите текст в Markdown..."
          >
            <Tabs
              items={[
                {
                  id: `${field.key}-editor`,
                  label: 'Редактор',
                  content: <MarkdownEditor.Textarea label="Редактор" id={`${field.key}-markdown`} name={field.key} />,
                },
                {
                  id: `${field.key}-preview`,
                  label: 'Просмотр',
                  content: <MarkdownEditor.Preview label="Предпросмотр" />,
                },
              ]}
              defaultActiveId={`${field.key}-editor`}
            />
          </MarkdownEditor>
          {hasError ? <Input.ErrorBag>{error}</Input.ErrorBag> : null}
        </div>
      );
    }

    const inputType: 'text' | 'number' | 'date' | 'email' | 'tel' | 'password' = (() => {
      if (fieldType === 'number') {
        return 'number';
      }

      if (fieldType === 'date') {
        return 'date';
      }

      if (fieldType === 'email' || fieldType === 'tel' || fieldType === 'password') {
        return fieldType;
      }

      return 'text';
    })();

    return (
      <div key={field.key} className={fieldClassName}>
        <Input>
          <Input.FloatLabel label={label} required={required} hasError={hasError} hint={tooltip} hintPlacement="auto">
            <Input.Field
              name={field.key}
              type={inputType}
              required={required}
              value={String(data[field.key] ?? '')}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          </Input.FloatLabel>
          {hasError ? <Input.ErrorTooltip target="input" content={error} placement="auto" /> : null}
        </Input>
      </div>
    );
  };

  if (!groupBySection) {
    return <>{visibleFields.map(renderField)}</>;
  }

  const grouped = visibleFields.reduce<Array<{ section: string; title: string; fields: DynamicFormField[] }>>((carry, field) => {
    const section = resolveDynamicFieldSection(field);
    const title = sectionLabels[section] ?? defaultSectionLabel(section);
    const index = carry.findIndex((item) => item.section === section);

    if (index === -1) {
      carry.push({ section, title, fields: [field] });

      return carry;
    }

    carry[index].fields.push(field);

    return carry;
  }, []);

  return (
    <>
      {grouped.map((group) => (
        <section key={group.section} className={sectionClassName}>
          <Text className={sectionTitleClassName}>{group.title}</Text>
          <Stack gap="12px">
            {group.fields.map(renderField)}
          </Stack>
        </section>
      ))}
    </>
  );
}

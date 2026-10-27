'use client';

import React from 'react';
import type { TaxFormType } from '@wave/contracts';
import { W9FormView } from './W9Form.view';
import { W8BenFormView } from './W8BenForm.view';
import { W8BenEUploadView } from './W8BenEUpload.view';

export function TaxWizardSelectorView({
  requiredForm,
  countryCode,
  onSubmitted,
}: {
  readonly requiredForm: TaxFormType;
  readonly countryCode: string;
  readonly onSubmitted: () => Promise<void>;
}): React.JSX.Element {
  if (requiredForm === 'W9') {
    return <W9FormView onSubmitted={onSubmitted} />;
  }

  if (requiredForm === 'W8BENE') {
    return <W8BenEUploadView defaultCountryCode={countryCode} onSubmitted={onSubmitted} />;
  }

  return <W8BenFormView defaultCountryCode={countryCode} onSubmitted={onSubmitted} />;
}

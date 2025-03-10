/**
 * Copyright (c) 2020-present, Goldman Sachs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  DEFAULT_TYPEAHEAD_SEARCH_LIMIT,
  DEFAULT_TYPEAHEAD_SEARCH_MINIMUM_SEARCH_LENGTH,
} from '@finos/legend-application';
import {
  QuerySearchSpecification,
  type LightQuery,
  type QueryInfo,
} from '@finos/legend-graph';
import type { DepotServerClient } from '@finos/legend-server-depot';
import {
  ActionState,
  assertErrorThrown,
  type GeneratorFn,
} from '@finos/legend-shared';
import { action, flow, makeObservable, observable } from 'mobx';
import type { LegendQueryApplicationStore } from './LegendQueryBaseStore.js';
import { BaseQuerySetupStore } from './QuerySetupStore.js';

export class EditExistingQuerySetupStore extends BaseQuerySetupStore {
  readonly loadQueriesState = ActionState.create();
  readonly loadQueryState = ActionState.create();

  queries: LightQuery[] = [];
  currentQuery?: LightQuery | undefined;
  currentQueryInfo?: QueryInfo | undefined;
  showCurrentUserQueriesOnly = false;

  constructor(
    applicationStore: LegendQueryApplicationStore,
    depotServerClient: DepotServerClient,
  ) {
    super(applicationStore, depotServerClient);

    makeObservable(this, {
      queries: observable,
      currentQuery: observable,
      currentQueryInfo: observable,
      showCurrentUserQueriesOnly: observable,
      setShowCurrentUserQueriesOnly: action,
      setCurrentQuery: flow,
      loadQueries: flow,
    });
  }

  setShowCurrentUserQueriesOnly(val: boolean): void {
    this.showCurrentUserQueriesOnly = val;
  }

  *setCurrentQuery(queryId: string | undefined): GeneratorFn<void> {
    if (queryId) {
      try {
        this.loadQueryState.inProgress();
        this.currentQuery =
          (yield this.graphManagerState.graphManager.getLightQuery(
            queryId,
          )) as LightQuery;
        const queryInfo =
          (yield this.graphManagerState.graphManager.getQueryInfo(
            queryId,
          )) as QueryInfo;
        queryInfo.content =
          (yield this.graphManagerState.graphManager.prettyLambdaContent(
            queryInfo.content,
          )) as string;
        this.currentQueryInfo = queryInfo;
      } catch (error) {
        assertErrorThrown(error);
        this.applicationStore.notifyError(error);
      } finally {
        this.loadQueryState.reset();
      }
    } else {
      this.currentQuery = undefined;
    }
  }

  *loadQueries(searchText: string): GeneratorFn<void> {
    const isValidSearchString =
      searchText.length >= DEFAULT_TYPEAHEAD_SEARCH_MINIMUM_SEARCH_LENGTH;
    this.loadQueriesState.inProgress();
    try {
      const searchSpecification = new QuerySearchSpecification();
      searchSpecification.searchTerm = isValidSearchString
        ? searchText
        : undefined;
      searchSpecification.limit = DEFAULT_TYPEAHEAD_SEARCH_LIMIT;
      searchSpecification.showCurrentUserQueriesOnly =
        this.showCurrentUserQueriesOnly;
      this.queries = (yield this.graphManagerState.graphManager.searchQueries(
        searchSpecification,
      )) as LightQuery[];
      this.loadQueriesState.pass();
    } catch (error) {
      assertErrorThrown(error);
      this.applicationStore.notifyError(error);
      this.loadQueriesState.fail();
    }
  }
}

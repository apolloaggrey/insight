import { describe, expect, it } from 'vitest';

import { parsePullRequestUrl } from '../src/services/github';
import { parseMergeRequestUrl } from '../src/services/gitlab';

describe('parsePullRequestUrl', () => {
	it('parses a valid GitHub pull request URL', () => {
		expect(parsePullRequestUrl('https://github.com/insight/context/pull/42')).toEqual({
			repo: 'insight/context',
			number: 42,
		});
	});

	it('rejects a URL that embeds github.com in the path of an unrelated host', () => {
		expect(parsePullRequestUrl('https://evil.com/https://github.com/insight/context/pull/42')).toBeNull();
	});

	it('rejects a lookalike hostname', () => {
		expect(parsePullRequestUrl('https://github.com.evil.com/insight/context/pull/42')).toBeNull();
	});

	it('rejects malformed URLs', () => {
		expect(parsePullRequestUrl('not a url')).toBeNull();
	});
});

describe('parseMergeRequestUrl', () => {
	it('parses a valid GitLab merge request URL', () => {
		expect(parseMergeRequestUrl('https://gitlab.com/insight/context/-/merge_requests/7')).toEqual({
			repo: 'insight/context',
			iid: 7,
		});
	});

	it('rejects a URL that embeds gitlab.com in the path of an unrelated host', () => {
		expect(
			parseMergeRequestUrl('https://evil.com/https://gitlab.com/insight/context/-/merge_requests/7'),
		).toBeNull();
	});

	it('rejects a lookalike hostname', () => {
		expect(parseMergeRequestUrl('https://gitlab.com.evil.com/insight/context/-/merge_requests/7')).toBeNull();
	});

	it('rejects malformed URLs', () => {
		expect(parseMergeRequestUrl('not a url')).toBeNull();
	});
});

import {
  hashText,
  markNotificationHandled,
  resetNotificationDedupState,
} from '../hooks/useAutoBookkeeping';

/**
 * 回归用例：微信/支付宝的扣费通知经常只有金额（如「已扣费¥9.29」），
 * 不含商户与时间。历史上去重是按「文案哈希」永久去重的，导致同额的第二笔
 * 及之后的支付被静默丢弃 —— 用户表现为「通知来了但 App 没反应」。
 *
 * 现在的语义：同一条通知的重复送达（实时 emit + 缓冲兜底）去重，
 * 不同笔支付（postTime 不同、间隔超过短窗口）必须都能记账。
 */
describe('支付通知去重（自动记账漏响应回归）', () => {
  const content = '【微信】微信支付\n已扣费¥9.29';
  const T0 = 1_700_000_000_000;

  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    resetNotificationDedupState();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(T0);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('同一条通知重复送达（事件 ID 相同）只处理一次', () => {
    const eventId = hashText(`WeChat|微信支付|已扣费¥9.29|${T0}`);
    expect(markNotificationHandled(eventId, content)).toBe(false);
    expect(markNotificationHandled(eventId, content)).toBe(true);
  });

  it('短窗口内同文案的重复送达（如系统分组通知）只处理一次', () => {
    // 文案相同但 postTime 略有差异，模拟子通知与聚合通知的重复
    expect(markNotificationHandled(hashText(`a|${T0}`), content)).toBe(false);
    expect(markNotificationHandled(hashText(`b|${T0 + 3000}`), content)).toBe(true);
  });

  it('间隔较久的同额支付必须能再次记账（不再永久去重）', () => {
    expect(markNotificationHandled(hashText(`a|${T0}`), content)).toBe(false);

    // 20 分钟后又一笔金额相同的扣费
    const later = T0 + 20 * 60 * 1000;
    nowSpy.mockReturnValue(later);
    const secondEventId = hashText(`WeChat|微信支付|已扣费¥9.29|${later}`);
    expect(markNotificationHandled(secondEventId, content)).toBe(false);
  });

  it('postTime 不同的同文案通知（同额不同笔）不受事件 ID 误伤', () => {
    expect(markNotificationHandled(hashText(`WeChat|微信支付|已扣费¥9.29|${T0}`), content)).toBe(
      false
    );

    // 刚好越过短窗口边界：文案相同但属于另一笔支付
    const later = T0 + 61_000;
    nowSpy.mockReturnValue(later);
    expect(
      markNotificationHandled(hashText(`WeChat|微信支付|已扣费¥9.29|${later}`), content)
    ).toBe(false);
  });

  it('hashText 对相同输入稳定、对不同输入不同', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });
});

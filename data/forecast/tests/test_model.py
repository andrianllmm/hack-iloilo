from forecast.model import harvest


def test_kernel_with_fixed_parameters():
    planted = [100.0] + [0.0] * 11
    weights = [0.1, 0.4, 0.3, 0.15, 0.05]
    result = harvest(planted, weights, yield_t_per_ha=4.0)
    assert result[:5] == [0.0] * 5
    assert result[5:10] == [40.0, 160.0, 120.0, 60.0, 20.0]
    assert result[10:] == [0.0, 0.0]

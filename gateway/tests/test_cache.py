import numpy as np

from app.services.cache import cosine


def test_cosine_identical_vectors():
    v = list(np.random.rand(768))
    assert cosine(v, v) > 0.9999


def test_cosine_orthogonal():
    a = [1.0] + [0.0] * 767
    b = [0.0, 1.0] + [0.0] * 766
    assert abs(cosine(a, b)) < 1e-6


def test_cosine_zero_vector_is_safe():
    assert cosine([0.0] * 768, [1.0] * 768) == 0.0

import React, { useState, useMemo, useCallback } from "react";
import { Container, Root, Text } from "@react-three/uikit";
import { Vector3 } from "three";

/**
 * メニューアイテムの型定義
 */
interface MenuItem {
    id: string;
    title: string;
    category: string;
    description?: string;
    icon?: string;
    tags?: string[];
    onSelect: () => void;
}

/**
 * ページネーション情報
 */
interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    totalItems: number;
}

/**
 * フィルター設定
 */
interface FilterConfig {
    category?: string;
    searchTerm?: string;
    tags?: string[];
}

/**
 * ブレッドクラム項目
 */
interface BreadcrumbItem {
    id: string;
    label: string;
    path: string[];
}

/**
 * MenuNavigatorのProps
 */
interface MenuNavigatorProps {
    items: MenuItem[];
    currentPath: string[];
    onNavigate: (path: string[]) => void;
    onItemSelect: (item: MenuItem) => void;
    itemsPerPage?: number;
    enableSearch?: boolean;
    enableFiltering?: boolean;
    enableBreadcrumbs?: boolean;
    position?: Vector3;
    scale?: number;
}

/**
 * 高度なメニューナビゲーションコンポーネント
 * ページネーション、検索、フィルタリング、ブレッドクラム機能を提供
 */
export default function MenuNavigator({
    items,
    currentPath,
    onNavigate,
    onItemSelect,
    itemsPerPage = 6,
    enableSearch = true,
    enableFiltering = true,
    enableBreadcrumbs = true,
    position = new Vector3(0, 0, 0),
    scale = 1,
}: MenuNavigatorProps) {
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // フィルタリングされたアイテム
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // 検索フィルター
            if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !item.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }

            // カテゴリフィルター
            if (selectedCategory && item.category !== selectedCategory) {
                return false;
            }

            // タグフィルター
            if (selectedTags.length > 0 && item.tags) {
                const hasMatchingTag = selectedTags.some(tag => item.tags!.includes(tag));
                if (!hasMatchingTag) return false;
            }

            return true;
        });
    }, [items, searchTerm, selectedCategory, selectedTags]);

    // ページネーション計算
    const paginationInfo: PaginationInfo = useMemo(() => {
        const totalItems = filteredItems.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        return {
            currentPage,
            totalPages,
            itemsPerPage,
            totalItems,
        };
    }, [filteredItems.length, itemsPerPage, currentPage]);

    // 現在のページのアイテム
    const currentPageItems = useMemo(() => {
        const startIndex = currentPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredItems.slice(startIndex, endIndex);
    }, [filteredItems, currentPage, itemsPerPage]);

    // カテゴリリスト
    const categories = useMemo(() => {
        const cats = new Set(items.map(item => item.category));
        return Array.from(cats);
    }, [items]);

    // ブレッドクラム生成
    const breadcrumbs = useMemo((): BreadcrumbItem[] => {
        const crumbs: BreadcrumbItem[] = [
            { id: 'home', label: 'Home', path: [] }
        ];

        currentPath.forEach((pathSegment, index) => {
            const path = currentPath.slice(0, index + 1);
            crumbs.push({
                id: pathSegment,
                label: pathSegment,
                path,
            });
        });

        return crumbs;
    }, [currentPath]);

    // イベントハンドラー
    const handlePageChange = useCallback((newPage: number) => {
        if (newPage >= 0 && newPage < paginationInfo.totalPages) {
            setCurrentPage(newPage);
        }
    }, [paginationInfo.totalPages]);

    const handleSearch = useCallback((term: string) => {
        setSearchTerm(term);
        setCurrentPage(0); // 検索時は最初のページに戻る
    }, []);

    const handleCategoryChange = useCallback((category: string) => {
        setSelectedCategory(category);
        setCurrentPage(0);
    }, []);

    const handleBreadcrumbClick = useCallback((breadcrumb: BreadcrumbItem) => {
        onNavigate(breadcrumb.path);
    }, [onNavigate]);

    const clearFilters = useCallback(() => {
        setSearchTerm("");
        setSelectedCategory("");
        setSelectedTags([]);
        setCurrentPage(0);
    }, []);

    return (
        <group position={position} scale={scale}>
            <Root>
                <Container
                    width={4}
                    height={3}
                    padding={0.1}
                    borderRadius={0.05}
                    backgroundColor="#1a1a1a"
                    borderColor="#444"
                    borderWidth={0.01}
                >
                    {/* ブレッドクラムナビゲーション */}
                    {enableBreadcrumbs && breadcrumbs.length > 1 && (
                        <Container
                            width="100%"
                            height={0.3}
                            marginBottom={0.1}
                            flexDirection="row"
                            alignItems="center"
                            backgroundColor="#2a2a2a"
                            borderRadius={0.02}
                            padding={0.05}
                        >
                            {breadcrumbs.map((crumb, index) => (
                                <React.Fragment key={crumb.id}>
                                    <Container
                                        onPointerDown={() => handleBreadcrumbClick(crumb)}
                                        padding={0.02}
                                        borderRadius={0.01}
                                        backgroundColor={index === breadcrumbs.length - 1 ? "#4a90e2" : "transparent"}
                                        cursor="pointer"
                                    >
                                        <Text
                                            fontSize={0.08}
                                            color={index === breadcrumbs.length - 1 ? "#ffffff" : "#cccccc"}
                                        >
                                            {crumb.label}
                                        </Text>
                                    </Container>
                                    {index < breadcrumbs.length - 1 && (
                                        <Text fontSize={0.08} color="#666666" marginX={0.02}>
                                            /
                                        </Text>
                                    )}
                                </React.Fragment>
                            ))}
                        </Container>
                    )}

                    {/* 検索・フィルターエリア */}
                    {(enableSearch || enableFiltering) && (
                        <Container
                            width="100%"
                            height={0.4}
                            marginBottom={0.1}
                            backgroundColor="#2a2a2a"
                            borderRadius={0.02}
                            padding={0.05}
                        >
                            {/* 検索バー */}
                            {enableSearch && (
                                <Container
                                    width="100%"
                                    height={0.15}
                                    marginBottom={0.05}
                                    backgroundColor="#333"
                                    borderRadius={0.02}
                                    padding={0.02}
                                    flexDirection="row"
                                    alignItems="center"
                                >
                                    <Text fontSize={0.06} color="#999" marginRight={0.02}>
                                        🔍
                                    </Text>
                                    <Text
                                        fontSize={0.07}
                                        color={searchTerm ? "#ffffff" : "#999"}
                                        flexGrow={1}
                                    >
                                        {searchTerm || "Search items..."}
                                    </Text>
                                </Container>
                            )}

                            {/* カテゴリフィルター */}
                            {enableFiltering && categories.length > 0 && (
                                <Container
                                    width="100%"
                                    height={0.12}
                                    flexDirection="row"
                                    gap={0.02}
                                    marginBottom={0.02}
                                >
                                    <Container
                                        onPointerDown={() => handleCategoryChange("")}
                                        padding={0.02}
                                        borderRadius={0.01}
                                        backgroundColor={!selectedCategory ? "#4a90e2" : "#444"}
                                        cursor="pointer"
                                    >
                                        <Text fontSize={0.06} color="#ffffff">
                                            All
                                        </Text>
                                    </Container>
                                    {categories.slice(0, 4).map(category => (
                                        <Container
                                            key={category}
                                            onPointerDown={() => handleCategoryChange(category)}
                                            padding={0.02}
                                            borderRadius={0.01}
                                            backgroundColor={selectedCategory === category ? "#4a90e2" : "#444"}
                                            cursor="pointer"
                                        >
                                            <Text fontSize={0.06} color="#ffffff">
                                                {category}
                                            </Text>
                                        </Container>
                                    ))}
                                </Container>
                            )}
                        </Container>
                    )}

                    {/* メインコンテンツエリア */}
                    <Container
                        width="100%"
                        height={2}
                        backgroundColor="#1e1e1e"
                        borderRadius={0.02}
                        padding={0.05}
                    >
                        {/* アイテムグリッド */}
                        <Container
                            width="100%"
                            height={1.6}
                            flexDirection="row"
                            flexWrap="wrap"
                            gap={0.05}
                            justifyContent="space-between"
                        >
                            {currentPageItems.map(item => (
                                <Container
                                    key={item.id}
                                    width={1.2}
                                    height={0.35}
                                    backgroundColor="#333"
                                    borderRadius={0.02}
                                    padding={0.03}
                                    cursor="pointer"
                                    onPointerDown={() => onItemSelect(item)}
                                    borderColor="#555"
                                    borderWidth={0.005}
                                >
                                    <Text
                                        fontSize={0.08}
                                        color="#ffffff"
                                        fontWeight="bold"
                                        marginBottom={0.02}
                                    >
                                        {item.title}
                                    </Text>
                                    <Text
                                        fontSize={0.06}
                                        color="#cccccc"
                                        marginBottom={0.02}
                                    >
                                        {item.category}
                                    </Text>
                                    {item.description && (
                                        <Text
                                            fontSize={0.05}
                                            color="#999"
                                        >
                                            {item.description.length > 50 ?
                                                item.description.substring(0, 50) + "..." :
                                                item.description}
                                        </Text>
                                    )}
                                </Container>
                            ))}
                        </Container>

                        {/* ページネーション */}
                        {paginationInfo.totalPages > 1 && (
                            <Container
                                width="100%"
                                height={0.3}
                                flexDirection="row"
                                justifyContent="center"
                                alignItems="center"
                                gap={0.02}
                                marginTop={0.05}
                            >
                                {/* 前のページボタン */}
                                <Container
                                    width={0.15}
                                    height={0.15}
                                    backgroundColor={currentPage > 0 ? "#4a90e2" : "#555"}
                                    borderRadius={0.02}
                                    justifyContent="center"
                                    alignItems="center"
                                    cursor={currentPage > 0 ? "pointer" : "default"}
                                    onPointerDown={() => currentPage > 0 && handlePageChange(currentPage - 1)}
                                >
                                    <Text fontSize={0.08} color="#ffffff">
                                        ‹
                                    </Text>
                                </Container>

                                {/* ページ番号 */}
                                <Text fontSize={0.07} color="#cccccc" marginX={0.05}>
                                    {currentPage + 1} / {paginationInfo.totalPages}
                                </Text>

                                {/* 次のページボタン */}
                                <Container
                                    width={0.15}
                                    height={0.15}
                                    backgroundColor={currentPage < paginationInfo.totalPages - 1 ? "#4a90e2" : "#555"}
                                    borderRadius={0.02}
                                    justifyContent="center"
                                    alignItems="center"
                                    cursor={currentPage < paginationInfo.totalPages - 1 ? "pointer" : "default"}
                                    onPointerDown={() => currentPage < paginationInfo.totalPages - 1 && handlePageChange(currentPage + 1)}
                                >
                                    <Text fontSize={0.08} color="#ffffff">
                                        ›
                                    </Text>
                                </Container>
                            </Container>
                        )}
                    </Container>

                    {/* フッター情報 */}
                    <Container
                        width="100%"
                        height={0.2}
                        flexDirection="row"
                        justifyContent="space-between"
                        alignItems="center"
                        marginTop={0.05}
                        padding={0.02}
                    >
                        <Text fontSize={0.06} color="#999">
                            {paginationInfo.totalItems} items
                        </Text>

                        {(searchTerm || selectedCategory || selectedTags.length > 0) && (
                            <Container
                                onPointerDown={clearFilters}
                                padding={0.02}
                                backgroundColor="#e74c3c"
                                borderRadius={0.02}
                                cursor="pointer"
                            >
                                <Text fontSize={0.06} color="#ffffff">
                                    Clear Filters
                                </Text>
                            </Container>
                        )}
                    </Container>
                </Container>
            </Root>
        </group>
    );
}

/**
 * 検索・フィルタリング用のユーティリティフック
 */
export function useMenuSearch(items: MenuItem[]) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filters, setFilters] = useState<FilterConfig>({});

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // 検索条件
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesTitle = item.title.toLowerCase().includes(searchLower);
                const matchesDescription = item.description?.toLowerCase().includes(searchLower);
                const matchesTags = item.tags?.some(tag => tag.toLowerCase().includes(searchLower));

                if (!matchesTitle && !matchesDescription && !matchesTags) {
                    return false;
                }
            }

            // カテゴリフィルター
            if (filters.category && item.category !== filters.category) {
                return false;
            }

            // タグフィルター
            if (filters.tags && filters.tags.length > 0) {
                const hasMatchingTag = filters.tags.some(tag => item.tags?.includes(tag));
                if (!hasMatchingTag) return false;
            }

            return true;
        });
    }, [items, searchTerm, filters]);

    const updateSearch = useCallback((term: string) => {
        setSearchTerm(term);
    }, []);

    const updateFilters = useCallback((newFilters: Partial<FilterConfig>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    const clearAll = useCallback(() => {
        setSearchTerm("");
        setFilters({});
    }, []);

    return {
        searchTerm,
        filters,
        filteredItems,
        updateSearch,
        updateFilters,
        clearAll,
    };
}
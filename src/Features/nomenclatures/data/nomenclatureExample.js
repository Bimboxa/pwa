const nomenclatureExample = {
  name: "Classification de matériaux générique",
  ranks: [
    {
      key: "category1",
      label: "Catégorie 1",
    },
    {
      key: "category2",
      label: "Catégorie 2",
    },
    {
      key: "category3",
      label: "Catégorie 3",
    },
  ],
  items: [
    {
      num: "1",
      label: "1 - Catégorie 1",
      children: [
        {
          num: "1.1",
          label: "Catégorie 1.1",
          children: [
            {
              num: "1.1.1",
              label: "Catégorie 1.1.1",
              type: "G",
              code: "1.1.1",
            },
            {
              num: "1.1.2",
              label: "Catégorie 1.1.2",
              type: "G",
              code: "1.1.2",
            },
          ],
        },
        {
          num: "1.2",
          label: "Catégorie 1.2",
          children: [
            {
              num: "1.2.1",
              label: "Catégorie 1.2.1",
              type: "G",
              code: "1.2.1",
            },
          ],
        },
      ],
    },
    {
      num: "2",
      label: "2 - Catégorie 2",
      children: [
        {
          num: "2.1",
          label: "Catégorie 2.1",
          children: [
            {
              num: "2.1.1",
              label: "Catégorie 2.1.1",
              type: "G",
              code: "2.1.1",
            },
            {
              num: "2.1.2",
              label: "Catégorie 2.1.2",
              type: "G",
              code: "2.1.2",
            },
          ],
        },
      ],
    },
    {
      num: "3",
      label: "3 - Catégorie 3",
      children: [
        {
          num: "3.1",
          label: "Catégorie 3.1",
          children: [
            {
              num: "3.1.1",
              label: "Catégorie 3.1.1",
              type: "G",
              code: "3.1.1",
            },
          ],
        },
        {
          num: "3.2",
          label: "Catégorie 3.2",
          children: [
            {
              num: "3.2.1",
              label: "Catégorie 3.2.1",
              type: "G",
              code: "3.2.1",
            },
          ],
        },
      ],
    },
    {
      num: "4",
      label: "4 - Catégorie 4",
      children: [
        {
          num: "4.1",
          label: "Catégorie 4.1",
          type: "G",
          code: "4.1",
        },
      ],
    },
    {
      num: "5",
      label: "5 - Catégorie 5",
      children: [
        {
          num: "5.1",
          label: "Catégorie 5.1",
          type: "G",
          code: "5.1",
        },
      ],
    },
    {
      num: "6",
      label: "6 - Catégorie 6",
      type: "G",
      code: "6",
    },
  ],
};

export default nomenclatureExample;
